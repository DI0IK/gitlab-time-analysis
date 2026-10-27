use axum::{
    Json,
    extract::{Path, Query, State},
};

use crate::{
    api::{
        activity::{ActivityFilterQuery, GroupActivityFeedResponse, compute_group_activity_scoped},
        analytics::{RepositorySummary, get_group_repositories},
        extractors::{AuthUser, verify_root_access},
        wiki::{WikiTarget, get_group_wiki_targets},
    },
    db::{
        groups::GroupRecord,
        merge_requests::{MergeRequestRecord, get_merge_requests_by_group},
        work_items::{WorkItemRecord, get_work_items_by_group},
    },
    domain::{
        analytics::{dashboard::GroupDashboardResponse, engine::compute_group_dashboard_scoped},
        gamification::evaluator::{LeaderboardEntry, compute_leaderboard_scoped},
    },
    error::AppError,
    state::AppState,
};

use crate::api::tenant::guard::resolve_group_under_root;

#[utoipa::path(
    get,
    path = "/api/{root_slug}/groups",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Managed root group tenant slug")
    ),
    responses(
        (status = 200, description = "Hierarchy tree of groups/subgroups for this root group", body = Vec<GroupRecord>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Root group not found")
    )
)]
pub async fn get_root_groups(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
) -> Result<Json<Vec<GroupRecord>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    let root_path = root.gitlab_group_path.trim().trim_matches('/');
    let prefix = format!("{root_path}/%");

    let groups = sqlx::query_as::<_, GroupRecord>(
        r#"
        SELECT id, full_path, name, parent_id, parent_name, level, web_url, synced_at
        FROM groups
        WHERE full_path = ?1 OR full_path LIKE ?2
        ORDER BY level ASC, name ASC
        "#,
    )
    .bind(root_path)
    .bind(&prefix)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(groups))
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/groups/{group_slug}/members",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        ("group_slug" = String, Path, description = "Group slug")
    ),
    responses(
        (status = 200, description = "List of verified group members", body = Vec<crate::db::groups::GroupMemberRecord>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Group not found")
    )
)]
pub async fn get_root_group_members(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((root_slug, group_slug)): Path<(String, String)>,
) -> Result<Json<Vec<crate::db::groups::GroupMemberRecord>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    let group = resolve_group_under_root(&state.db, &root, &group_slug).await?;

    let members = crate::db::groups::get_group_members(&state.db, &group.id).await?;
    Ok(Json(members))
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/groups/{group_slug}/dashboard",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        ("group_slug" = String, Path, description = "Group slug or full path")
    ),
    responses(
        (status = 200, description = "Sprints, burndown, and metrics scoped to this root group", body = GroupDashboardResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    )
)]
pub async fn get_root_group_dashboard(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((root_slug, group_slug)): Path<(String, String)>,
) -> Result<Json<GroupDashboardResponse>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;

    let cache_key = format!("tenant:{root_slug}:group:{group_slug}:dashboard");
    if let Some(res) = state
        .cache
        .get(&cache_key)
        .await
        .and_then(|c| serde_json::from_str::<GroupDashboardResponse>(&c).ok())
    {
        return Ok(Json(res));
    }

    let group = resolve_group_under_root(&state.db, &root, &group_slug).await?;

    let dashboard =
        compute_group_dashboard_scoped(&state.db, &group, Some(&state.config), Some(&root)).await?;

    if let Ok(serialized) = serde_json::to_string(&dashboard) {
        state.cache.insert(cache_key, serialized).await;
    }

    Ok(Json(dashboard))
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/groups/{group_slug}/activity",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        ("group_slug" = String, Path, description = "Group slug"),
        ActivityFilterQuery
    ),
    responses(
        (status = 200, description = "Scoped activity feed", body = GroupActivityFeedResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    )
)]
pub async fn get_root_group_activity(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((root_slug, group_slug)): Path<(String, String)>,
    Query(query): Query<ActivityFilterQuery>,
) -> Result<Json<GroupActivityFeedResponse>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    compute_group_activity_scoped(state, group_slug, query, Some(&root)).await
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/groups/{group_slug}/leaderboard",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        ("group_slug" = String, Path, description = "Group slug")
    ),
    responses(
        (status = 200, description = "Scoped leaderboard", body = Vec<LeaderboardEntry>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    )
)]
pub async fn get_root_group_leaderboard(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((root_slug, group_slug)): Path<(String, String)>,
) -> Result<Json<Vec<LeaderboardEntry>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    let group = resolve_group_under_root(&state.db, &root, &group_slug).await?;

    let leaderboard = compute_leaderboard_scoped(&state.db, Some(&group.id), Some(&root)).await?;
    Ok(Json(leaderboard))
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/groups/{group_slug}/work-items",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        ("group_slug" = String, Path, description = "Group slug")
    ),
    responses(
        (status = 200, description = "Work items hierarchy", body = Vec<WorkItemRecord>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    )
)]
pub async fn get_root_group_work_items(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((root_slug, group_slug)): Path<(String, String)>,
) -> Result<Json<Vec<WorkItemRecord>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    let group = resolve_group_under_root(&state.db, &root, &group_slug).await?;

    let work_items = get_work_items_by_group(&state.db, &group.id).await?;
    Ok(Json(work_items))
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/groups/{group_slug}/merge-requests",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        ("group_slug" = String, Path, description = "Group slug")
    ),
    responses(
        (status = 200, description = "Merge requests", body = Vec<MergeRequestRecord>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    )
)]
pub async fn get_root_group_merge_requests(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((root_slug, group_slug)): Path<(String, String)>,
) -> Result<Json<Vec<MergeRequestRecord>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    let group = resolve_group_under_root(&state.db, &root, &group_slug).await?;

    let mrs = get_merge_requests_by_group(&state.db, &group.full_path).await?;
    Ok(Json(mrs))
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/groups/{group_slug}/repositories",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        ("group_slug" = String, Path, description = "Group slug")
    ),
    responses(
        (status = 200, description = "Repositories list", body = Vec<RepositorySummary>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    )
)]
pub async fn get_root_group_repositories(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((root_slug, group_slug)): Path<(String, String)>,
) -> Result<Json<Vec<RepositorySummary>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    let group = resolve_group_under_root(&state.db, &root, &group_slug).await?;
    get_group_repositories(State(state), Path(group.full_path)).await
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/groups/{group_slug}/wiki/targets",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        ("group_slug" = String, Path, description = "Group slug")
    ),
    responses(
        (status = 200, description = "Wikis list", body = Vec<WikiTarget>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    )
)]
pub async fn get_root_group_wiki_targets(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((root_slug, group_slug)): Path<(String, String)>,
) -> Result<Json<Vec<WikiTarget>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    let group = resolve_group_under_root(&state.db, &root, &group_slug).await?;
    get_group_wiki_targets(State(state), Path(group.full_path)).await
}
