use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

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
pub(crate) struct GitLabFileRawResponse {
    pub file_name: String,
    pub file_path: String,
    pub size: i64,
    pub encoding: String,
    pub content: String,
    #[serde(rename = "ref")]
    pub ref_name: Option<String>,
    pub commit_id: Option<String>,
    pub last_commit_id: Option<String>,
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
