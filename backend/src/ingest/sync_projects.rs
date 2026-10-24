use chrono::Utc;
use serde::Deserialize;
use serde_json::json;

use crate::{
    db::projects::upsert_project, error::AppError, gitlab::client::GitLabClient, state::AppState,
};

#[derive(Debug, Deserialize)]
struct GroupProjectsResponse {
    group: Option<GroupNode>,
}

#[derive(Debug, Deserialize)]
struct GroupNode {
    projects: Option<ProjectConnection>,
}

#[derive(Debug, Deserialize)]
struct ProjectConnection {
    #[serde(rename = "pageInfo")]
    page_info: Option<PageInfo>,
    nodes: Option<Vec<ProjectNode>>,
}

#[derive(Debug, Deserialize)]
struct PageInfo {
    #[serde(rename = "hasNextPage", default)]
    has_next_page: bool,
    #[serde(rename = "endCursor")]
    end_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProjectNode {
    id: String,
    name: String,
    #[serde(rename = "fullPath")]
    full_path: String,
    #[serde(rename = "webUrl")]
    web_url: String,
    #[serde(default)]
    archived: bool,
    group: Option<GroupRef>,
}

#[derive(Debug, Deserialize)]
struct GroupRef {
    id: String,
}

pub async fn sync_group_projects(
    client: &GitLabClient,
    state: &AppState,
    root_path: &str,
) -> Result<Vec<String>, AppError> {
    let query = r#"
    query GetGroupProjects($fullPath: ID!, $after: String) {
      group(fullPath: $fullPath) {
        projects(includeSubgroups: true, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            name
            fullPath
            webUrl
            archived
            group { id }
          }
        }
      }
    }
    "#;

    let mut cursor: Option<String> = None;
    let mut project_ids = Vec::new();
    let now = Utc::now();

    loop {
        let vars = json!({
            "fullPath": root_path,
            "after": cursor,
        });

        let resp: GroupProjectsResponse = client.query_graphql(query, Some(vars)).await?;
        let group = match resp.group {
            Some(g) => g,
            None => {
                tracing::warn!("Group not found when querying projects: {root_path}");
                break;
            }
        };

        let conn = match group.projects {
            Some(p) => p,
            None => break,
        };

        if let Some(nodes) = conn.nodes {
            for p in nodes {
                upsert_project(
                    &state.db,
                    &p.id,
                    p.group.as_ref().map(|g| g.id.as_str()),
                    &p.name,
                    &p.full_path,
                    &p.web_url,
                    p.archived,
                    now,
                )
                .await?;
                project_ids.push(p.id);
            }
        }

        match conn.page_info {
            Some(pi) if pi.has_next_page && pi.end_cursor.is_some() => {
                cursor = pi.end_cursor;
            }
            _ => break,
        }
    }

    // Prune deleted projects from SQLite under this root hierarchy
    let clean = root_path.trim_end_matches('/');
    let prefix = format!("{clean}/%");
    let existing_ids = sqlx::query_scalar::<_, String>(
        "SELECT id FROM projects WHERE full_path LIKE ?1 OR full_path = ?2",
    )
    .bind(&prefix)
    .bind(clean)
    .fetch_all(&state.db)
    .await?;

    for eid in existing_ids {
        if !project_ids.contains(&eid) {
            tracing::info!("Pruning deleted GitLab project from SQLite: {eid}");
            let _ = sqlx::query("DELETE FROM projects WHERE id = ?1")
                .bind(&eid)
                .execute(&state.db)
                .await;
        }
    }

    Ok(project_ids)
}
