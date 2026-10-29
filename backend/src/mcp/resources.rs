use crate::{
    api::{
        extractors::{AuthUser, verify_root_access},
        tenant::guard::resolve_group_under_root,
    },
    db::permissions::get_user_accessible_root_groups,
    domain::{
        analytics::engine::compute_group_dashboard_scoped,
        gamification::evaluator::compute_leaderboard_scoped,
    },
    mcp::protocol::{ResourceContent, ResourceDefinition, ResourceReadResult},
    state::AppState,
};

pub fn list_resources() -> Vec<ResourceDefinition> {
    vec![
        ResourceDefinition {
            uri: "gitlab://groups".to_string(),
            name: "Accessible Root Groups".to_string(),
            description: Some(
                "Dynamic list of all tenant root groups accessible to the authenticated user"
                    .to_string(),
            ),
            mime_type: Some("application/json".to_string()),
        },
        ResourceDefinition {
            uri: "gitlab://{root_slug}/sprints/current".to_string(),
            name: "Current Sprint Status".to_string(),
            description: Some(
                "Current sprint status, burndown progress, and time estimates for a group"
                    .to_string(),
            ),
            mime_type: Some("application/json".to_string()),
        },
        ResourceDefinition {
            uri: "gitlab://{root_slug}/leaderboard".to_string(),
            name: "Gamification Leaderboard".to_string(),
            description: Some(
                "Gamification leaderboard standings, XP rankings, and achievements for a group"
                    .to_string(),
            ),
            mime_type: Some("application/json".to_string()),
        },
    ]
}

pub async fn read_resource(
    state: &AppState,
    auth: &AuthUser,
    uri: &str,
) -> Result<ResourceReadResult, String> {
    if uri == "gitlab://groups" {
        let groups =
            get_user_accessible_root_groups(&state.db, &auth.user.gitlab_id, auth.user.is_admin)
                .await
                .map_err(|e| format!("Failed to read groups: {e}"))?;

        let text = serde_json::to_string_pretty(&groups).unwrap_or_default();
        return Ok(ResourceReadResult {
            contents: vec![ResourceContent {
                uri: uri.to_string(),
                mime_type: Some("application/json".to_string()),
                text,
            }],
        });
    }

    if let Some(rest) = uri.strip_prefix("gitlab://") {
        let parts: Vec<&str> = rest.split('/').collect();
        if parts.len() >= 3 && parts[1] == "sprints" && parts[2] == "current" {
            let root_slug = parts[0];
            let root = verify_root_access(&state.db, &auth.user, root_slug)
                .await
                .map_err(|e| format!("Access denied: {e}"))?;

            let group = resolve_group_under_root(&state.db, &root, root_slug)
                .await
                .map_err(|e| format!("Failed to resolve group: {e}"))?;

            let dashboard =
                compute_group_dashboard_scoped(&state.db, &group, Some(&state.config), Some(&root))
                    .await
                    .map_err(|e| format!("Failed to compute sprint metrics: {e}"))?;

            let current_sprint_num = dashboard.current_sprint;
            let current_sprint = dashboard
                .sprints
                .into_iter()
                .find(|s| Some(s.sprint_number) == current_sprint_num);
            let text = serde_json::to_string_pretty(&current_sprint).unwrap_or_default();

            return Ok(ResourceReadResult {
                contents: vec![ResourceContent {
                    uri: uri.to_string(),
                    mime_type: Some("application/json".to_string()),
                    text,
                }],
            });
        }

        if parts.len() >= 2 && parts[1] == "leaderboard" {
            let root_slug = parts[0];
            let root = verify_root_access(&state.db, &auth.user, root_slug)
                .await
                .map_err(|e| format!("Access denied: {e}"))?;

            let leaderboard = compute_leaderboard_scoped(&state.db, Some(&root.id), Some(&root))
                .await
                .map_err(|e| format!("Failed to compute leaderboard: {e}"))?;

            let text = serde_json::to_string_pretty(&leaderboard).unwrap_or_default();

            return Ok(ResourceReadResult {
                contents: vec![ResourceContent {
                    uri: uri.to_string(),
                    mime_type: Some("application/json".to_string()),
                    text,
                }],
            });
        }
    }

    Err(format!("Unknown or unhandled resource URI: {uri}"))
}
