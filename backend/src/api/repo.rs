use axum::{
    Json,
    extract::{Query, State},
};
use base64::Engine;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use crate::{
    api::extractors::OptionalAuthUser, error::AppError, gitlab::client::GitLabClient,
    state::AppState,
};

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RepoBranchCommit {
    pub id: String,
    pub short_id: String,
    pub title: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RepoBranch {
    pub name: String,
    #[serde(default)]
    pub default: bool,
    #[serde(default)]
    pub protected: bool,
    pub commit: Option<RepoBranchCommit>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RepoTreeItem {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub path: String,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RepoFileContent {
    pub file_name: String,
    pub file_path: String,
    pub size: i64,
    pub content: String,
    pub is_binary: bool,
    pub ref_name: String,
    pub commit_id: Option<String>,
    pub last_commit_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitLabFileRawResponse {
    file_name: String,
    file_path: String,
    size: i64,
    encoding: String,
    content: String,
    #[serde(rename = "ref")]
    ref_name: Option<String>,
    commit_id: Option<String>,
    last_commit_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RepoCommit {
    pub id: String,
    pub short_id: String,
    pub title: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub authored_date: Option<String>,
    pub web_url: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct RepoProjectQuery {
    pub project: String,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct RepoTreeQuery {
    pub project: String,
    #[serde(rename = "ref")]
    pub ref_name: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct RepoBlobQuery {
    pub project: String,
    #[serde(rename = "ref")]
    pub ref_name: Option<String>,
    pub file_path: String,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct RepoCommitsQuery {
    pub project: String,
    #[serde(rename = "ref")]
    pub ref_name: Option<String>,
    pub path: Option<String>,
    pub limit: Option<usize>,
}

fn get_gitlab_client(state: &AppState, auth: &OptionalAuthUser) -> GitLabClient {
    let token = auth
        .0
        .as_ref()
        .map(|u| u.access_token.clone())
        .or_else(|| state.config.gitlab_token.clone());
    GitLabClient::new(
        state.http.clone(),
        state.config.gitlab_domain.clone(),
        token,
    )
}

fn encode_path(path: &str) -> String {
    url::form_urlencoded::byte_serialize(path.as_bytes()).collect()
}

#[utoipa::path(
    get,
    path = "/api/repo/branches",
    tag = "Repository",
    params(RepoProjectQuery),
    responses(
        (status = 200, description = "List of repository branches", body = Vec<RepoBranch>),
        (status = 404, description = "Repository not found")
    )
)]
pub async fn list_branches(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Query(query): Query<RepoProjectQuery>,
) -> Result<Json<Vec<RepoBranch>>, AppError> {
    let client = get_gitlab_client(&state, &auth);
    let encoded_project = encode_path(&query.project);
    let endpoint = format!("projects/{encoded_project}/repository/branches?per_page=100");
    let branches: Vec<RepoBranch> = client.get_rest(&endpoint).await?;
    Ok(Json(branches))
}

#[utoipa::path(
    get,
    path = "/api/repo/tree",
    tag = "Repository",
    params(RepoTreeQuery),
    responses(
        (status = 200, description = "Repository file and directory tree", body = Vec<RepoTreeItem>),
        (status = 404, description = "Repository or path not found")
    )
)]
pub async fn get_tree(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Query(query): Query<RepoTreeQuery>,
) -> Result<Json<Vec<RepoTreeItem>>, AppError> {
    let client = get_gitlab_client(&state, &auth);
    let encoded_project = encode_path(&query.project);

    let mut params = vec!["per_page=100".to_string()];
    if let Some(ref_name) = &query.ref_name
        && !ref_name.is_empty()
    {
        params.push(format!("ref={}", encode_path(ref_name)));
    }
    if let Some(path) = &query.path {
        let clean = path.trim_matches('/');
        if !clean.is_empty() {
            params.push(format!("path={}", encode_path(clean)));
        }
    }

    let endpoint = format!(
        "projects/{encoded_project}/repository/tree?{}",
        params.join("&")
    );
    let tree: Vec<RepoTreeItem> = client.get_rest(&endpoint).await?;
    Ok(Json(tree))
}

#[utoipa::path(
    get,
    path = "/api/repo/blob",
    tag = "Repository",
    params(RepoBlobQuery),
    responses(
        (status = 200, description = "Repository file content and metadata", body = RepoFileContent),
        (status = 404, description = "File not found")
    )
)]
pub async fn get_blob(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Query(query): Query<RepoBlobQuery>,
) -> Result<Json<RepoFileContent>, AppError> {
    let client = get_gitlab_client(&state, &auth);
    let encoded_project = encode_path(&query.project);
    let encoded_file_path = encode_path(query.file_path.trim_matches('/'));

    let mut endpoint = format!("projects/{encoded_project}/repository/files/{encoded_file_path}");
    if let Some(ref_name) = &query.ref_name
        && !ref_name.is_empty()
    {
        endpoint.push_str(&format!("?ref={}", encode_path(ref_name)));
    }

    let raw: GitLabFileRawResponse = client.get_rest(&endpoint).await?;

    let (content, is_binary) = if raw.encoding == "base64" {
        match base64::prelude::BASE64_STANDARD.decode(raw.content.replace(['\n', '\r', ' '], "")) {
            Ok(bytes) => {
                // Check if binary (null bytes or invalid utf-8)
                if bytes.contains(&0) {
                    (String::new(), true)
                } else {
                    match String::from_utf8(bytes) {
                        Ok(text) => (text, false),
                        Err(_) => (String::new(), true),
                    }
                }
            }
            Err(_) => (String::new(), true),
        }
    } else {
        (raw.content, false)
    };

    Ok(Json(RepoFileContent {
        file_name: raw.file_name,
        file_path: raw.file_path,
        size: raw.size,
        content,
        is_binary,
        ref_name: raw.ref_name.unwrap_or_else(|| "HEAD".to_string()),
        commit_id: raw.commit_id,
        last_commit_id: raw.last_commit_id,
    }))
}

#[utoipa::path(
    get,
    path = "/api/repo/commits",
    tag = "Repository",
    params(RepoCommitsQuery),
    responses(
        (status = 200, description = "Commit history log", body = Vec<RepoCommit>),
        (status = 404, description = "Repository not found")
    )
)]
pub async fn list_commits(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Query(query): Query<RepoCommitsQuery>,
) -> Result<Json<Vec<RepoCommit>>, AppError> {
    let client = get_gitlab_client(&state, &auth);
    let encoded_project = encode_path(&query.project);

    let limit = query.limit.unwrap_or(30).clamp(1, 100);
    let mut params = vec![format!("per_page={limit}")];

    if let Some(ref_name) = &query.ref_name
        && !ref_name.is_empty()
    {
        params.push(format!("ref_name={}", encode_path(ref_name)));
    }
    if let Some(path) = &query.path {
        let clean = path.trim_matches('/');
        if !clean.is_empty() {
            params.push(format!("path={}", encode_path(clean)));
        }
    }

    let endpoint = format!(
        "projects/{encoded_project}/repository/commits?{}",
        params.join("&")
    );
    let commits: Vec<RepoCommit> = client.get_rest(&endpoint).await?;
    Ok(Json(commits))
}
