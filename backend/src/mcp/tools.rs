use serde_json::{Value, json};

use crate::{
    api::{
        activity::{ActivityFilterQuery, compute_group_activity_scoped},
        extractors::{AuthUser, verify_root_access},
        tenant::guard::{resolve_group_under_root, resolve_project_under_root},
    },
    db::{
        merge_requests::get_merge_requests_by_group,
        notes::get_notes_for_work_item,
        permissions::get_user_accessible_root_groups,
        timelogs::get_timelogs_for_group,
        work_items::{get_work_item, get_work_items_by_group},
    },
    domain::{
        analytics::engine::compute_group_dashboard_scoped,
        gamification::evaluator::{
            evaluate_user_gamification_scoped, fetch_user_contribution_stats_scoped,
        },
    },
    git::{mirror::get_repo_dir, wiki_reader::get_local_wiki_page},
    mcp::protocol::{ToolCallResult, ToolDefinition},
    state::AppState,
};

pub fn list_tools() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "list_accessible_groups".to_string(),
            description: "List all GitLab root groups accessible to the authenticated user with their configurations.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "get_group_metrics".to_string(),
            description: "Get high-level sprint metrics, total time tracked, work item completion, and velocity for a root group or subgroup.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "root_slug": {
                        "type": "string",
                        "description": "Slug of the root group (e.g. 'tinf24')"
                    },
                    "group_slug": {
                        "type": "string",
                        "description": "Optional subgroup or project slug to scope metrics (e.g. 'r1-wc', defaults to root group)"
                    }
                },
                "required": ["root_slug"],
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "query_work_items".to_string(),
            description: "Search and list work items (issues, tasks, epics) in a root group or subgroup, with optional filtering by state, type, or search term.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "root_slug": {
                        "type": "string",
                        "description": "Slug of the root group"
                    },
                    "group_slug": {
                        "type": "string",
                        "description": "Optional subgroup or project slug to scope search (e.g. 'r1-wc')"
                    },
                    "state": {
                        "type": "string",
                        "description": "Optional state filter: 'OPEN', 'CLOSED', or 'ALL' (default 'ALL')",
                        "enum": ["ALL", "OPEN", "CLOSED"]
                    },
                    "work_item_type": {
                        "type": "string",
                        "description": "Optional type filter: 'issue', 'task', or 'epic'"
                    },
                    "search": {
                        "type": "string",
                        "description": "Optional substring to search within title or description"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of items to return (default 50, max 100)"
                    }
                },
                "required": ["root_slug"],
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "get_work_item_details".to_string(),
            description: "Get comprehensive details of a work item, including title, description, time estimates, time spent, and discussion comments/notes.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "root_slug": {
                        "type": "string",
                        "description": "Slug of the root group"
                    },
                    "work_item_id": {
                        "type": "string",
                        "description": "ID of the work item (e.g. 'gid://gitlab/WorkItem/12345')"
                    }
                },
                "required": ["root_slug", "work_item_id"],
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "query_timelogs".to_string(),
            description: "Query timelog entries recorded on work items and merge requests within a root group or subgroup.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "root_slug": {
                        "type": "string",
                        "description": "Slug of the root group"
                    },
                    "group_slug": {
                        "type": "string",
                        "description": "Optional subgroup or project slug to scope timelogs (e.g. 'r1-wc')"
                    },
                    "username": {
                        "type": "string",
                        "description": "Optional filter by GitLab username"
                    },
                    "sprint_number": {
                        "type": "integer",
                        "description": "Optional filter by sprint number"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of entries to return (default 50, max 100)"
                    }
                },
                "required": ["root_slug"],
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "get_user_analytics".to_string(),
            description: "Get detailed analytics, gamification progress, badges, and contribution summary for a specific developer in a root group or subgroup.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "root_slug": {
                        "type": "string",
                        "description": "Slug of the root group"
                    },
                    "username": {
                        "type": "string",
                        "description": "GitLab username of the developer"
                    },
                    "group_slug": {
                        "type": "string",
                        "description": "Optional subgroup slug to scope contributions (e.g. 'r1-wc')"
                    }
                },
                "required": ["root_slug", "username"],
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "query_merge_requests".to_string(),
            description: "List merge requests in a root group or subgroup with status, branches, review discussion counts, and author information.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "root_slug": {
                        "type": "string",
                        "description": "Slug of the root group"
                    },
                    "group_slug": {
                        "type": "string",
                        "description": "Optional subgroup or project slug to scope merge requests (e.g. 'r1-wc')"
                    },
                    "state": {
                        "type": "string",
                        "description": "Optional state filter: 'opened', 'merged', 'closed', or 'all'",
                        "enum": ["all", "opened", "merged", "closed"]
                    },
                    "author": {
                        "type": "string",
                        "description": "Optional filter by author username"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of merge requests to return (default 50, max 100)"
                    }
                },
                "required": ["root_slug"],
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "get_wiki_page".to_string(),
            description: "Read the markdown content of a project's wiki page.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "root_slug": {
                        "type": "string",
                        "description": "Slug of the root group"
                    },
                    "project_path": {
                        "type": "string",
                        "description": "Full path of the project (e.g. 'my-group/my-project')"
                    },
                    "group_slug": {
                        "type": "string",
                        "description": "Optional alias for project_path (e.g. 'r1-wc/wiki')"
                    },
                    "page_slug": {
                        "type": "string",
                        "description": "Slug of the wiki page (e.g. 'home' or 'architecture')"
                    }
                },
                "required": ["root_slug", "page_slug"],
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "query_activity".to_string(),
            description: "Query aggregated chronological activity feed (commits/MR events, work item events, comments, and timelogs) for a root group or subgroup.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "root_slug": {
                        "type": "string",
                        "description": "Slug of the root group"
                    },
                    "group_slug": {
                        "type": "string",
                        "description": "Optional subgroup or project slug to scope activity (e.g. 'r1-wc', defaults to root group)"
                    },
                    "author": {
                        "type": "string",
                        "description": "Optional filter by GitLab username"
                    },
                    "sprint_number": {
                        "type": "integer",
                        "description": "Optional filter by sprint number"
                    },
                    "activity_type": {
                        "type": "string",
                        "description": "Optional filter: 'comment', 'system_note', 'timelog', 'mr', 'work_item'",
                        "enum": ["comment", "system_note", "timelog", "mr", "work_item"]
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of activity items to return (default 50, max 200)"
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Offset for pagination (default 0)"
                    }
                },
                "required": ["root_slug"],
                "additionalProperties": false
            }),
        },
    ]
}

pub async fn execute_tool(
    state: &AppState,
    auth: &AuthUser,
    name: &str,
    args: &Value,
) -> ToolCallResult {
    match name {
        "list_accessible_groups" => {
            match get_user_accessible_root_groups(
                &state.db,
                &auth.user.gitlab_id,
                auth.user.is_admin,
            )
            .await
            {
                Ok(groups) => {
                    let summaries: Vec<_> = groups
                        .into_iter()
                        .map(|g| {
                            json!({
                                "id": g.id,
                                "slug": g.slug,
                                "name": g.name,
                                "gitlab_group_path": g.gitlab_group_path,
                                "project_start_date": g.project_start_date,
                                "project_end_date": g.project_end_date,
                                "sprint_duration_weeks": g.sprint_duration_weeks,
                            })
                        })
                        .collect();
                    ToolCallResult::text(
                        serde_json::to_string_pretty(&summaries).unwrap_or_default(),
                    )
                }
                Err(e) => ToolCallResult::error(format!("Failed to retrieve groups: {e}")),
            }
        }
        "get_group_metrics" => {
            let root_slug = match args.get("root_slug").and_then(|v| v.as_str()) {
                Some(s) => s,
                None => return ToolCallResult::error("Missing required parameter: root_slug"),
            };

            let root = match verify_root_access(&state.db, &auth.user, root_slug).await {
                Ok(r) => r,
                Err(e) => {
                    return ToolCallResult::error(format!("Access denied or group not found: {e}"));
                }
            };

            let target_slug = args
                .get("group_slug")
                .or_else(|| args.get("subgroup_slug"))
                .and_then(|v| v.as_str())
                .unwrap_or(root_slug);

            let group = match resolve_group_under_root(&state.db, &root, target_slug).await {
                Ok(g) => g,
                Err(e) => return ToolCallResult::error(format!("Failed to resolve group: {e}")),
            };

            match compute_group_dashboard_scoped(
                &state.db,
                &group,
                Some(&state.config),
                Some(&root),
            )
            .await
            {
                Ok(metrics) => {
                    ToolCallResult::text(serde_json::to_string_pretty(&metrics).unwrap_or_default())
                }
                Err(e) => ToolCallResult::error(format!("Failed to compute metrics: {e}")),
            }
        }
        "query_work_items" => {
            let root_slug = match args.get("root_slug").and_then(|v| v.as_str()) {
                Some(s) => s,
                None => return ToolCallResult::error("Missing required parameter: root_slug"),
            };

            let root = match verify_root_access(&state.db, &auth.user, root_slug).await {
                Ok(r) => r,
                Err(e) => return ToolCallResult::error(format!("Access denied: {e}")),
            };

            let target_slug = args
                .get("group_slug")
                .or_else(|| args.get("subgroup_slug"))
                .and_then(|v| v.as_str())
                .unwrap_or(root_slug);

            let group = match resolve_group_under_root(&state.db, &root, target_slug).await {
                Ok(g) => g,
                Err(e) => return ToolCallResult::error(format!("Failed to resolve group: {e}")),
            };

            let state_filter = args.get("state").and_then(|v| v.as_str()).unwrap_or("ALL");
            let type_filter = args.get("work_item_type").and_then(|v| v.as_str());
            let search = args
                .get("search")
                .and_then(|v| v.as_str())
                .map(|s| s.to_lowercase());
            let limit = args
                .get("limit")
                .and_then(|v| v.as_i64())
                .unwrap_or(50)
                .clamp(1, 100) as usize;

            match get_work_items_by_group(&state.db, &group.id).await {
                Ok(items) => {
                    let filtered: Vec<_> = items
                        .into_iter()
                        .filter(|item| {
                            if state_filter != "ALL"
                                && !item.state.eq_ignore_ascii_case(state_filter)
                            {
                                return false;
                            }
                            if let Some(tf) = type_filter
                                && !item.work_item_type.eq_ignore_ascii_case(tf)
                            {
                                return false;
                            }
                            if let Some(ref q) = search {
                                let title_match = item.title.to_lowercase().contains(q);
                                let desc_match = item
                                    .description
                                    .as_deref()
                                    .unwrap_or("")
                                    .to_lowercase()
                                    .contains(q);
                                if !title_match && !desc_match {
                                    return false;
                                }
                            }
                            true
                        })
                        .take(limit)
                        .map(|item| {
                            json!({
                                "id": item.id,
                                "iid": item.iid,
                                "type": item.work_item_type,
                                "title": item.title,
                                "state": item.state,
                                "project_path": item.project_path,
                                "time_estimate_seconds": item.time_estimate,
                                "total_time_spent_seconds": item.total_time_spent,
                                "web_url": item.web_url,
                                "start_date": item.start_date,
                                "due_date": item.due_date,
                                "created_at": item.created_at,
                            })
                        })
                        .collect();

                    ToolCallResult::text(
                        serde_json::to_string_pretty(&filtered).unwrap_or_default(),
                    )
                }
                Err(e) => ToolCallResult::error(format!("Failed to query work items: {e}")),
            }
        }
        "get_work_item_details" => {
            let root_slug = match args.get("root_slug").and_then(|v| v.as_str()) {
                Some(s) => s,
                None => return ToolCallResult::error("Missing required parameter: root_slug"),
            };

            if let Err(e) = verify_root_access(&state.db, &auth.user, root_slug).await {
                return ToolCallResult::error(format!("Access denied: {e}"));
            }

            let work_item_id = match args.get("work_item_id").and_then(|v| v.as_str()) {
                Some(id) => id,
                None => return ToolCallResult::error("Missing required parameter: work_item_id"),
            };

            match get_work_item(&state.db, work_item_id).await {
                Ok(Some(item)) => {
                    let notes = get_notes_for_work_item(&state.db, &item.id)
                        .await
                        .unwrap_or_default();
                    let notes_summary: Vec<_> = notes
                        .into_iter()
                        .map(|n| {
                            json!({
                                "author": n.author_username,
                                "author_name": n.author_name,
                                "body": n.body,
                                "is_system": n.is_system,
                                "created_at": n.created_at,
                            })
                        })
                        .collect();

                    let detail = json!({
                        "work_item": item,
                        "notes_count": notes_summary.len(),
                        "notes": notes_summary,
                    });
                    ToolCallResult::text(serde_json::to_string_pretty(&detail).unwrap_or_default())
                }
                Ok(None) => ToolCallResult::error(format!("Work item not found: {work_item_id}")),
                Err(e) => ToolCallResult::error(format!("Error fetching work item: {e}")),
            }
        }
        "query_timelogs" => {
            let root_slug = match args.get("root_slug").and_then(|v| v.as_str()) {
                Some(s) => s,
                None => return ToolCallResult::error("Missing required parameter: root_slug"),
            };

            let root = match verify_root_access(&state.db, &auth.user, root_slug).await {
                Ok(r) => r,
                Err(e) => return ToolCallResult::error(format!("Access denied: {e}")),
            };

            let target_slug = args
                .get("group_slug")
                .or_else(|| args.get("subgroup_slug"))
                .and_then(|v| v.as_str())
                .unwrap_or(root_slug);

            let group = match resolve_group_under_root(&state.db, &root, target_slug).await {
                Ok(g) => g,
                Err(e) => return ToolCallResult::error(format!("Failed to resolve group: {e}")),
            };

            let user_filter = args.get("username").and_then(|v| v.as_str());
            let sprint_filter = args.get("sprint_number").and_then(|v| v.as_i64());
            let limit = args
                .get("limit")
                .and_then(|v| v.as_i64())
                .unwrap_or(50)
                .clamp(1, 100) as usize;

            match get_timelogs_for_group(&state.db, &group.id).await {
                Ok(logs) => {
                    let filtered: Vec<_> = logs
                        .into_iter()
                        .filter(|t| {
                            if let Some(u) = user_filter
                                && !t.username.eq_ignore_ascii_case(u)
                            {
                                return false;
                            }
                            if let Some(s) = sprint_filter
                                && t.sprint_number != Some(s)
                            {
                                return false;
                            }
                            true
                        })
                        .take(limit)
                        .map(|t| {
                            json!({
                                "id": t.id,
                                "username": t.username,
                                "time_spent_seconds": t.time_spent,
                                "hours": (t.time_spent as f64) / 3600.0,
                                "spent_at": t.spent_at,
                                "sprint_number": t.sprint_number,
                                "summary": t.summary,
                                "web_url": t.web_url,
                            })
                        })
                        .collect();

                    ToolCallResult::text(
                        serde_json::to_string_pretty(&filtered).unwrap_or_default(),
                    )
                }
                Err(e) => ToolCallResult::error(format!("Failed to fetch timelogs: {e}")),
            }
        }
        "get_user_analytics" => {
            let root_slug = match args.get("root_slug").and_then(|v| v.as_str()) {
                Some(s) => s,
                None => return ToolCallResult::error("Missing required parameter: root_slug"),
            };

            let root = match verify_root_access(&state.db, &auth.user, root_slug).await {
                Ok(r) => r,
                Err(e) => return ToolCallResult::error(format!("Access denied: {e}")),
            };

            let username = match args.get("username").and_then(|v| v.as_str()) {
                Some(u) => u,
                None => return ToolCallResult::error("Missing required parameter: username"),
            };

            let target_slug = args
                .get("group_slug")
                .or_else(|| args.get("subgroup_slug"))
                .and_then(|v| v.as_str());

            let scoped_group = if let Some(ts) = target_slug {
                match resolve_group_under_root(&state.db, &root, ts).await {
                    Ok(g) => Some(g),
                    Err(e) => {
                        return ToolCallResult::error(format!("Failed to resolve group: {e}"));
                    }
                }
            } else {
                None
            };

            let (stats, _timelogs) = match fetch_user_contribution_stats_scoped(
                &state.db,
                username,
                Some(&root),
            )
            .await
            {
                Ok(s) => s,
                Err(e) => {
                    return ToolCallResult::error(format!("Failed to retrieve user stats: {e}"));
                }
            };

            let gamification =
                match evaluate_user_gamification_scoped(&state.db, username, Some(&root)).await {
                    Ok(g) => g,
                    Err(e) => {
                        return ToolCallResult::error(format!(
                            "Failed to evaluate gamification: {e}"
                        ));
                    }
                };

            let group_scoped_stats = if let Some(ref g) = scoped_group {
                let logs = get_timelogs_for_group(&state.db, &g.id)
                    .await
                    .unwrap_or_default();
                let user_logs: Vec<_> = logs
                    .into_iter()
                    .filter(|t| t.username.eq_ignore_ascii_case(username))
                    .collect();
                let group_seconds: i64 = user_logs.iter().map(|t| t.time_spent).sum();
                Some(json!({
                    "group_full_path": g.full_path,
                    "timelogs_count": user_logs.len(),
                    "total_seconds": group_seconds,
                    "total_hours": (group_seconds as f64 / 3600.0 * 10.0).round() / 10.0,
                }))
            } else {
                None
            };

            let result = json!({
                "username": username,
                "root_slug": root_slug,
                "stats": stats,
                "gamification": gamification,
                "group_scoped_stats": group_scoped_stats,
            });
            ToolCallResult::text(serde_json::to_string_pretty(&result).unwrap_or_default())
        }
        "query_merge_requests" => {
            let root_slug = match args.get("root_slug").and_then(|v| v.as_str()) {
                Some(s) => s,
                None => return ToolCallResult::error("Missing required parameter: root_slug"),
            };

            let root = match verify_root_access(&state.db, &auth.user, root_slug).await {
                Ok(r) => r,
                Err(e) => return ToolCallResult::error(format!("Access denied: {e}")),
            };

            let state_filter = args.get("state").and_then(|v| v.as_str()).unwrap_or("all");
            let author_filter = args.get("author").and_then(|v| v.as_str());
            let limit = args
                .get("limit")
                .and_then(|v| v.as_i64())
                .unwrap_or(50)
                .clamp(1, 100) as usize;

            let target_slug = args
                .get("group_slug")
                .or_else(|| args.get("subgroup_slug"))
                .and_then(|v| v.as_str());

            let group_path = if let Some(ts) = target_slug {
                match resolve_group_under_root(&state.db, &root, ts).await {
                    Ok(g) => g.full_path,
                    Err(e) => {
                        return ToolCallResult::error(format!("Failed to resolve group: {e}"));
                    }
                }
            } else if !root.gitlab_group_path.is_empty() {
                root.gitlab_group_path.clone()
            } else {
                root.slug.clone()
            };

            match get_merge_requests_by_group(&state.db, &group_path).await {
                Ok(mrs) => {
                    let filtered: Vec<_> = mrs
                        .into_iter()
                        .filter(|mr| {
                            if state_filter != "all" && !mr.state.eq_ignore_ascii_case(state_filter)
                            {
                                return false;
                            }
                            if let Some(author) = author_filter
                                && !mr.author_username.eq_ignore_ascii_case(author)
                            {
                                return false;
                            }
                            true
                        })
                        .take(limit)
                        .map(|mr| {
                            json!({
                                "id": mr.id,
                                "iid": mr.iid,
                                "title": mr.title,
                                "state": mr.state,
                                "author": mr.author_username,
                                "project_path": mr.project_path,
                                "source_branch": mr.source_branch,
                                "target_branch": mr.target_branch,
                                "additions": mr.additions,
                                "deletions": mr.deletions,
                                "discussion_count": mr.discussion_count,
                                "created_at": mr.created_at,
                                "merged_at": mr.merged_at,
                                "web_url": mr.web_url,
                            })
                        })
                        .collect();

                    ToolCallResult::text(
                        serde_json::to_string_pretty(&filtered).unwrap_or_default(),
                    )
                }
                Err(e) => ToolCallResult::error(format!("Failed to query merge requests: {e}")),
            }
        }
        "get_wiki_page" => {
            let root_slug = match args.get("root_slug").and_then(|v| v.as_str()) {
                Some(s) => s,
                None => return ToolCallResult::error("Missing required parameter: root_slug"),
            };

            let root = match verify_root_access(&state.db, &auth.user, root_slug).await {
                Ok(r) => r,
                Err(e) => return ToolCallResult::error(format!("Access denied: {e}")),
            };

            let raw_project_path = match args
                .get("project_path")
                .or_else(|| args.get("group_slug"))
                .and_then(|v| v.as_str())
            {
                Some(p) => p,
                None => {
                    return ToolCallResult::error(
                        "Missing required parameter: project_path (or group_slug)",
                    );
                }
            };

            let project_path = match resolve_project_under_root(&root, raw_project_path) {
                Ok(p) => p,
                Err(e) => return ToolCallResult::error(format!("Access denied: {e}")),
            };

            let page_slug = match args.get("page_slug").and_then(|v| v.as_str()) {
                Some(s) => s,
                None => return ToolCallResult::error("Missing required parameter: page_slug"),
            };

            let git_dir = get_repo_dir(&state.config.repos_dir, &project_path, true);
            match get_local_wiki_page(&git_dir, page_slug, None).await {
                Ok(page) => {
                    ToolCallResult::text(serde_json::to_string_pretty(&page).unwrap_or_default())
                }
                Err(e) => ToolCallResult::error(format!(
                    "Wiki page '{page_slug}' not found or error reading: {e}"
                )),
            }
        }
        "query_activity" => {
            let root_slug = match args.get("root_slug").and_then(|v| v.as_str()) {
                Some(s) => s,
                None => return ToolCallResult::error("Missing required parameter: root_slug"),
            };

            let root = match verify_root_access(&state.db, &auth.user, root_slug).await {
                Ok(r) => r,
                Err(e) => return ToolCallResult::error(format!("Access denied: {e}")),
            };

            let target_slug = args
                .get("group_slug")
                .or_else(|| args.get("subgroup_slug"))
                .and_then(|v| v.as_str())
                .unwrap_or(root_slug);

            let group = match resolve_group_under_root(&state.db, &root, target_slug).await {
                Ok(g) => g,
                Err(e) => return ToolCallResult::error(format!("Failed to resolve group: {e}")),
            };

            let query = ActivityFilterQuery {
                author: args
                    .get("author")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                sprint: args.get("sprint_number").and_then(|v| v.as_i64()),
                activity_type: args
                    .get("activity_type")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                limit: args
                    .get("limit")
                    .and_then(|v| v.as_i64())
                    .map(|l| l as usize),
                offset: args
                    .get("offset")
                    .and_then(|v| v.as_i64())
                    .map(|o| o as usize),
            };

            match compute_group_activity_scoped(state.clone(), group.full_path, query, Some(&root))
                .await
            {
                Ok(axum::Json(feed)) => {
                    ToolCallResult::text(serde_json::to_string_pretty(&feed).unwrap_or_default())
                }
                Err(e) => ToolCallResult::error(format!("Failed to query activity: {e}")),
            }
        }
        unknown => ToolCallResult::error(format!("Unknown tool: {unknown}")),
    }
}
