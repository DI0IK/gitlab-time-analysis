use chrono::Utc;
use serde::Deserialize;
use serde_json::json;

use crate::{
    db::{
        groups::{upsert_group, upsert_group_member},
        users::upsert_user,
    },
    error::AppError,
    gitlab::client::GitLabClient,
    state::AppState,
};

#[derive(Debug, Deserialize)]
struct GroupQueryData {
    group: Option<GroupNode>,
}

#[derive(Debug, Deserialize)]
struct GroupNode {
    id: String,
    name: String,
    #[serde(rename = "fullPath")]
    full_path: String,
    #[serde(rename = "webUrl")]
    web_url: String,
    #[serde(rename = "descendantGroups")]
    descendant_groups: Option<SubgroupConnection>,
    #[serde(rename = "groupMembers")]
    group_members: Option<MemberConnection>,
}

#[derive(Debug, Deserialize)]
struct SubgroupConnection {
    nodes: Option<Vec<SubgroupNode>>,
}

#[derive(Debug, Deserialize)]
struct SubgroupNode {
    id: String,
    name: String,
    #[serde(rename = "fullPath")]
    full_path: String,
    #[serde(rename = "webUrl")]
    web_url: String,
    parent: Option<ParentNode>,
}

#[derive(Debug, Deserialize)]
struct ParentNode {
    id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct MemberConnection {
    nodes: Option<Vec<MemberNode>>,
}

#[derive(Debug, Deserialize)]
struct MemberNode {
    user: Option<UserNode>,
    #[serde(rename = "accessLevel")]
    access_level: Option<AccessLevelNode>,
}

#[derive(Debug, Deserialize)]
struct UserNode {
    id: String,
    username: String,
    name: String,
    #[serde(rename = "avatarUrl")]
    avatar_url: Option<String>,
    #[serde(rename = "webUrl")]
    web_url: String,
    #[serde(default)]
    bot: bool,
}

#[derive(Debug, Deserialize)]
struct AccessLevelNode {
    #[serde(rename = "stringValue")]
    string_value: Option<String>,
}

pub async fn sync_group_hierarchy(
    client: &GitLabClient,
    state: &AppState,
    root_path: &str,
) -> Result<Vec<String>, AppError> {
    let query = r#"
    query GetGroupHierarchy($fullPath: ID!) {
      group(fullPath: $fullPath) {
        id
        name
        fullPath
        webUrl
        descendantGroups {
          nodes {
            id
            name
            fullPath
            webUrl
            parent { id name }
          }
        }
        groupMembers {
          nodes {
            user { id username name avatarUrl webUrl bot }
            accessLevel { stringValue }
          }
        }
      }
    }
    "#;

    let resp: GroupQueryData = client
        .query_graphql(query, Some(json!({ "fullPath": root_path })))
        .await?;

    let root_group = match resp.group {
        Some(g) => g,
        None => {
            return Err(AppError::NotFound(format!(
                "GitLab root group {root_path} not found"
            )));
        }
    };

    let now = Utc::now();
    let mut group_ids = Vec::new();

    // 1. Upsert root group
    upsert_group(
        &state.db,
        &root_group.id,
        &root_group.full_path,
        &root_group.name,
        None,
        None,
        0,
        &root_group.web_url,
        now,
    )
    .await?;
    group_ids.push(root_group.id.clone());

    // 2. Upsert root members
    if let Some(members) = root_group.group_members.and_then(|m| m.nodes) {
        for m in members {
            if let Some(u) = m.user {
                let gitlab_id = u.id.replace("gid://gitlab/User/", "");
                upsert_user(
                    &state.db,
                    &gitlab_id,
                    &u.username,
                    &u.name,
                    u.avatar_url.as_deref(),
                    &u.web_url,
                    u.bot,
                )
                .await?;
                let access = m.access_level.and_then(|a| a.string_value);
                upsert_group_member(
                    &state.db,
                    &root_group.id,
                    &u.username,
                    true,
                    access.as_deref(),
                )
                .await?;
            }
        }
    }

    let root_slash_count = root_group.full_path.matches('/').count();

    // 3. Upsert descendant groups
    if let Some(mut descendants) = root_group.descendant_groups.and_then(|d| d.nodes) {
        // Sort by hierarchy depth so parents are ALWAYS inserted before their children
        descendants.sort_by_key(|sg| sg.full_path.matches('/').count());

        let mut inserted_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
        inserted_ids.insert(root_group.id.clone());

        for sg in descendants {
            let parent_id = sg
                .parent
                .as_ref()
                .map(|p| p.id.as_str())
                .filter(|pid| inserted_ids.contains(*pid))
                .or(Some(&root_group.id));
            let parent_name = sg.parent.as_ref().map(|p| p.name.as_str());
            let level = (sg
                .full_path
                .matches('/')
                .count()
                .saturating_sub(root_slash_count)) as i64;
            upsert_group(
                &state.db,
                &sg.id,
                &sg.full_path,
                &sg.name,
                parent_id,
                parent_name,
                level,
                &sg.web_url,
                now,
            )
            .await?;
            inserted_ids.insert(sg.id.clone());
            group_ids.push(sg.id);
        }
    }

    // 4. Prune groups that were deleted on GitLab under this root hierarchy
    let root_prefix = format!("{}/%", root_group.full_path.trim_end_matches('/'));
    let existing_ids = sqlx::query_scalar::<_, String>(
        "SELECT id FROM groups WHERE full_path = ?1 OR full_path LIKE ?2",
    )
    .bind(&root_group.full_path)
    .bind(&root_prefix)
    .fetch_all(&state.db)
    .await?;

    for eid in existing_ids {
        if !group_ids.contains(&eid) {
            tracing::info!("Pruning deleted GitLab group from SQLite: {eid}");
            sqlx::query("DELETE FROM groups WHERE id = ?1")
                .bind(&eid)
                .execute(&state.db)
                .await?;
        }
    }

    Ok(group_ids)
}
