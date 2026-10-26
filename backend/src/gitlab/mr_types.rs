use super::graphql::{GitLabNoteConnection, GitLabUserNode, PageInfo};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeRequestsData {
    pub group: Option<GroupMergeRequestsNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupMergeRequestsNode {
    pub merge_requests: Option<MergeRequestConnection>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeRequestConnection {
    pub page_info: PageInfo,
    pub nodes: Option<Vec<GitLabMergeRequestNode>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabMergeRequestNode {
    pub id: String,
    pub iid: String,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub web_url: String,
    pub created_at: String,
    pub merged_at: Option<String>,
    pub closed_at: Option<String>,
    pub source_branch: String,
    pub target_branch: String,
    pub author: Option<GitLabUserNode>,
    pub head_pipeline: Option<GitLabPipelineNode>,
    pub project: Option<GitLabProjectRef>,
    pub diff_stats_summary: Option<GitLabDiffStats>,
    pub approved_by: Option<GitLabApprovedByConnection>,
    pub user_discussions_count: Option<i64>,
    pub notes: Option<GitLabNoteConnection>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabPipelineNode {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabProjectRef {
    pub full_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabDiffStats {
    pub additions: Option<i64>,
    pub deletions: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabApprovedByConnection {
    pub nodes: Option<Vec<GitLabApproverNode>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabApproverNode {
    pub username: String,
}
