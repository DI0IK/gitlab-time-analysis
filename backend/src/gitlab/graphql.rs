use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphQLRequest {
    pub query: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variables: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct GraphQLResponse<T> {
    pub data: Option<T>,
    pub errors: Option<Vec<GraphQLError>>,
}

#[derive(Debug, Deserialize)]
pub struct GraphQLError {
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageInfo {
    #[serde(default)]
    pub has_next_page: bool,
    pub end_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupHierarchyData {
    pub group: Option<GitLabGroupNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabGroupNode {
    pub id: String,
    pub name: String,
    pub full_path: String,
    pub web_url: String,
    pub descendant_groups: Option<GitLabGroupConnection>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabGroupConnection {
    pub nodes: Option<Vec<GitLabSubgroupNode>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabSubgroupNode {
    pub id: String,
    pub name: String,
    pub full_path: String,
    pub web_url: String,
    pub parent: Option<GitLabParentRef>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabParentRef {
    pub id: String,
    pub name: String,
    pub full_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkItemsData {
    pub group: Option<GroupWorkItemsNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupWorkItemsNode {
    pub work_items: Option<WorkItemConnection>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkItemConnection {
    pub page_info: PageInfo,
    pub nodes: Option<Vec<GitLabWorkItemNode>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabWorkItemNode {
    pub id: String,
    pub iid: String,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub web_url: String,
    pub created_at: String,
    pub closed_at: Option<String>,
    pub work_item_type: Option<WorkItemTypeNode>,
    pub widgets: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkItemTypeNode {
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssuesData {
    pub group: Option<GroupIssuesNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupIssuesNode {
    pub issues: Option<IssueConnection>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueConnection {
    pub page_info: PageInfo,
    pub nodes: Option<Vec<GitLabIssueNode>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabIssueNode {
    pub id: String,
    pub iid: String,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub web_url: String,
    pub created_at: String,
    pub closed_at: Option<String>,
    pub time_estimate: Option<i64>,
    pub total_time_spent: Option<i64>,
    pub labels: Option<GitLabLabelConnection>,
    pub epic: Option<GitLabEpicRef>,
    pub timelogs: Option<GitLabTimelogConnection>,
    pub notes: Option<GitLabNoteConnection>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabLabelConnection {
    pub nodes: Option<Vec<GitLabLabelNode>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabLabelNode {
    pub id: String,
    pub title: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabEpicRef {
    pub id: String,
    pub iid: Option<String>,
    pub group: Option<GitLabGroupRef>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabGroupRef {
    pub id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabTimelogConnection {
    pub nodes: Option<Vec<GitLabTimelogNode>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabTimelogNode {
    pub id: String,
    pub spent_at: String,
    pub time_spent: i64,
    pub summary: Option<String>,
    pub user: Option<GitLabUserNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabUserNode {
    pub id: Option<String>,
    pub username: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub web_url: Option<String>,
    pub bot: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabNoteConnection {
    pub nodes: Option<Vec<GitLabNoteNode>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabNoteNode {
    pub id: String,
    pub body: String,
    #[serde(default)]
    pub system: bool,
    pub system_note_icon_name: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub url: Option<String>,
    pub internal: Option<bool>,
    pub resolvable: Option<bool>,
    pub resolved: Option<bool>,
    pub author: Option<GitLabUserNode>,
    pub discussion: Option<GitLabDiscussionRef>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLabDiscussionRef {
    pub id: String,
}
