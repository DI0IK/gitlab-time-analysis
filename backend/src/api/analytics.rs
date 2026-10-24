use axum::{
    Json,
    extract::{Path, State},
};

use crate::{
    db::{
        groups::get_group_by_slug,
        merge_requests::{MergeRequestRecord, get_merge_requests_by_group},
        work_items::{WorkItemRecord, get_work_items_by_group},
    },
    domain::analytics::{
        comparison::ComparisonResponse,
        dashboard::GroupDashboardResponse,
        engine::{compute_comparison, compute_group_dashboard},
    },
    error::AppError,
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/groups/{slug}/dashboard",
    tag = "Analytics",
    params(
        ("slug" = String, Path, description = "Group slug or ID (e.g. 'G1-TischleinDeckDich')")
    ),
    responses(
        (status = 200, description = "Sprint progress, effort fairness, and category distribution", body = GroupDashboardResponse),
        (status = 404, description = "Group not found")
    )
)]
pub async fn get_group_dashboard(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<GroupDashboardResponse>, AppError> {
    let cache_key = format!("group:{slug}:dashboard");
    if let Some(res) = state
        .cache
        .get(&cache_key)
        .await
        .and_then(|c| serde_json::from_str::<GroupDashboardResponse>(&c).ok())
    {
        return Ok(Json(res));
    }

    let group = get_group_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group '{slug}' not found")))?;

    let dashboard = compute_group_dashboard(&state.db, &group, Some(&state.config)).await?;
    if let Ok(serialized) = serde_json::to_string(&dashboard) {
        state.cache.insert(cache_key, serialized).await;
    }

    Ok(Json(dashboard))
}

#[utoipa::path(
    get,
    path = "/api/groups/{slug}/work-items",
    tag = "Analytics",
    params(
        ("slug" = String, Path, description = "Group slug or ID")
    ),
    responses(
        (status = 200, description = "List of epics, issues, and tasks for the group", body = Vec<WorkItemRecord>),
        (status = 404, description = "Group not found")
    )
)]
pub async fn get_group_work_items(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Vec<WorkItemRecord>>, AppError> {
    let group = get_group_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group '{slug}' not found")))?;

    let work_items = get_work_items_by_group(&state.db, &group.id).await?;
    Ok(Json(work_items))
}

#[utoipa::path(
    get,
    path = "/api/groups/{slug}/merge-requests",
    tag = "Analytics",
    params(
        ("slug" = String, Path, description = "Group slug or ID")
    ),
    responses(
        (status = 200, description = "List of merge requests for the group", body = Vec<MergeRequestRecord>),
        (status = 404, description = "Group not found")
    )
)]
pub async fn get_group_merge_requests(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Vec<MergeRequestRecord>>, AppError> {
    let group = get_group_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group '{slug}' not found")))?;

    let mrs = get_merge_requests_by_group(&state.db, &group.full_path).await?;
    Ok(Json(mrs))
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct RepositorySummary {
    pub name: String,
    pub full_path: String,
    pub web_url: String,
    pub work_items_count: usize,
    pub merge_requests_count: usize,
}

#[utoipa::path(
    get,
    path = "/api/groups/{slug}/repositories",
    tag = "Analytics",
    params(
        ("slug" = String, Path, description = "Group slug or ID")
    ),
    responses(
        (status = 200, description = "List of project repositories under the group", body = Vec<RepositorySummary>),
        (status = 404, description = "Group not found")
    )
)]
pub async fn get_group_repositories(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Vec<RepositorySummary>>, AppError> {
    let group = get_group_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group '{slug}' not found")))?;

    let clean = group.full_path.trim_end_matches('/');
    let path_prefix = format!("{clean}/%");
    let rows = sqlx::query_as::<_, (String, Option<String>, i64, i64)>(
        r#"
        SELECT p.path,
               pr.name,
               COALESCE(w.cnt, 0) as work_items_count,
               COALESCE(m.cnt, 0) as merge_requests_count
        FROM (
            SELECT DISTINCT full_path as path FROM projects
            WHERE (full_path LIKE ?1 OR full_path = ?2) AND archived = 0
            UNION
            SELECT DISTINCT project_path as path FROM work_items 
            WHERE project_path IS NOT NULL 
              AND work_item_type != 'epic' 
              AND (project_path LIKE ?1 OR project_path = ?2)
            UNION
            SELECT DISTINCT project_path as path FROM merge_requests 
            WHERE project_path IS NOT NULL 
              AND (project_path LIKE ?1 OR project_path = ?2)
        ) p
        LEFT JOIN projects pr ON p.path = pr.full_path
        LEFT JOIN (
            SELECT project_path, COUNT(*) as cnt 
            FROM work_items 
            WHERE project_path IS NOT NULL AND work_item_type != 'epic' 
            GROUP BY project_path
        ) w ON p.path = w.project_path
        LEFT JOIN (
            SELECT project_path, COUNT(*) as cnt 
            FROM merge_requests 
            WHERE project_path IS NOT NULL 
            GROUP BY project_path
        ) m ON p.path = m.project_path
        WHERE p.path NOT IN (SELECT full_path FROM groups)
        ORDER BY p.path ASC
        "#,
    )
    .bind(&path_prefix)
    .bind(clean)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::Database)?;

    let repos = rows
        .into_iter()
        .map(|(path, pr_name, wi_cnt, mr_cnt)| {
            let name = pr_name
                .filter(|n| !n.is_empty())
                .unwrap_or_else(|| path.split('/').next_back().unwrap_or(&path).to_string());
            let web_url = format!(
                "{}/{}",
                state.config.gitlab_domain.trim_end_matches('/'),
                path
            );
            RepositorySummary {
                name,
                full_path: path,
                web_url,
                work_items_count: wi_cnt as usize,
                merge_requests_count: mr_cnt as usize,
            }
        })
        .collect();

    Ok(Json(repos))
}

#[utoipa::path(
    get,
    path = "/api/comparison",
    tag = "Analytics",
    responses(
        (status = 200, description = "Cross-group comparative analytics and sprint benchmarks", body = ComparisonResponse)
    )
)]
pub async fn get_cohort_comparison(
    State(state): State<AppState>,
) -> Result<Json<ComparisonResponse>, AppError> {
    let cache_key = "analytics:comparison".to_string();
    if let Some(res) = state
        .cache
        .get(&cache_key)
        .await
        .and_then(|c| serde_json::from_str::<ComparisonResponse>(&c).ok())
    {
        return Ok(Json(res));
    }

    let comparison = compute_comparison(&state.db).await?;
    if let Ok(serialized) = serde_json::to_string(&comparison) {
        state.cache.insert(cache_key, serialized).await;
    }

    Ok(Json(comparison))
}
