use axum::{
    Json,
    extract::{Query, State},
};
use base64::Engine;

use super::types::{
    GitLabFileRawResponse, RepoBlobQuery, RepoBranch, RepoCommit, RepoCommitsQuery,
    RepoFileContent, RepoProjectQuery, RepoTreeItem, RepoTreeQuery,
};
use crate::{
    api::extractors::OptionalAuthUser,
    error::AppError,
    git::{
        mirror::{get_repo_dir, sync_bare_repo},
        repo_reader::{get_local_blob, get_local_tree, list_local_branches, list_local_commits},
    },
    gitlab::client::GitLabClient,
    state::AppState,
};

fn get_token(state: &AppState, project: &str, auth: &OptionalAuthUser) -> Option<String> {
    auth.0
        .as_ref()
        .map(|u| u.access_token.clone())
        .or_else(|| state.config.get_token_for_path(project))
}

fn get_gitlab_client(state: &AppState, project: &str, auth: &OptionalAuthUser) -> GitLabClient {
    let token = get_token(state, project, auth);
    GitLabClient::new(
        state.http.clone(),
        state.config.gitlab_domain.clone(),
        token,
    )
}

fn encode_path(path: &str) -> String {
    url::form_urlencoded::byte_serialize(path.as_bytes()).collect()
}

fn trigger_background_sync(state: AppState, project: String, token: Option<String>) {
    tokio::spawn(async move {
        let _ = sync_bare_repo(
            &state.config.repos_dir,
            &state.config.gitlab_domain,
            &project,
            token.as_deref(),
            false,
        )
        .await;
    });
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
    let git_dir = get_repo_dir(&state.config.repos_dir, &query.project, false);

    // 1. Try serving from local bare mirror in < 2ms
    if git_dir.join("HEAD").exists()
        && let Ok(branches) = list_local_branches(&git_dir).await
    {
        return Ok(Json(branches));
    }

    // 2. Trigger async background clone to populate mirror for future calls
    let token = get_token(&state, &query.project, &auth);
    trigger_background_sync(state.clone(), query.project.clone(), token);

    // 3. Fallback to GitLab REST API
    let client = get_gitlab_client(&state, &query.project, &auth);
    let encoded_project = encode_path(&query.project);
    let endpoint = format!("projects/{encoded_project}/repository/branches?per_page=100");
    let branches: Vec<RepoBranch> = match client.get_rest(&endpoint).await {
        Ok(b) => b,
        Err(AppError::NotFound(_)) => Vec::new(),
        Err(e) => return Err(e),
    };
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
    let git_dir = get_repo_dir(&state.config.repos_dir, &query.project, false);

    // 1. Try serving from local bare mirror
    if git_dir.join("HEAD").exists()
        && let Ok(tree) =
            get_local_tree(&git_dir, query.ref_name.as_deref(), query.path.as_deref()).await
    {
        return Ok(Json(tree));
    }

    // 2. Fallback to GitLab REST API
    let client = get_gitlab_client(&state, &query.project, &auth);
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
    let tree: Vec<RepoTreeItem> = match client.get_rest(&endpoint).await {
        Ok(t) => t,
        Err(AppError::NotFound(_)) => Vec::new(),
        Err(e) => return Err(e),
    };
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
    let git_dir = get_repo_dir(&state.config.repos_dir, &query.project, false);

    // 1. Try serving from local bare mirror
    if git_dir.join("HEAD").exists()
        && let Ok(blob) =
            get_local_blob(&git_dir, query.ref_name.as_deref(), &query.file_path).await
    {
        return Ok(Json(blob));
    }

    // 2. Fallback to GitLab REST API
    let client = get_gitlab_client(&state, &query.project, &auth);
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
    let git_dir = get_repo_dir(&state.config.repos_dir, &query.project, false);

    // 1. Try serving from local bare mirror
    if git_dir.join("HEAD").exists()
        && let Ok(commits) = list_local_commits(
            &git_dir,
            query.ref_name.as_deref(),
            query.path.as_deref(),
            query.limit.unwrap_or(30),
        )
        .await
    {
        return Ok(Json(commits));
    }

    // 2. Fallback to GitLab REST API
    let client = get_gitlab_client(&state, &query.project, &auth);
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
    let commits: Vec<RepoCommit> = match client.get_rest(&endpoint).await {
        Ok(c) => c,
        Err(AppError::NotFound(_)) => Vec::new(),
        Err(e) => return Err(e),
    };
    Ok(Json(commits))
}

#[utoipa::path(
    post,
    path = "/api/repo/sync",
    tag = "Repository",
    params(RepoProjectQuery),
    responses(
        (status = 200, description = "Trigger immediate mirror sync", body = String)
    )
)]
pub async fn trigger_repo_sync(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Query(query): Query<RepoProjectQuery>,
) -> Result<Json<String>, AppError> {
    let token = get_token(&state, &query.project, &auth);
    sync_bare_repo(
        &state.config.repos_dir,
        &state.config.gitlab_domain,
        &query.project,
        token.as_deref(),
        false,
    )
    .await?;
    Ok(Json("Repository mirror synced successfully".to_string()))
}
