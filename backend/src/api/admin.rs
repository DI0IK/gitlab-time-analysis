use axum::{
    Json,
    extract::{Path, State},
    response::IntoResponse,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    api::extractors::RequireAdmin,
    db::{
        managed_root_groups::{
            ManagedRootGroupRecord, create_managed_root_group, delete_managed_root_group,
            get_all_managed_root_groups, get_managed_root_group_by_id, update_managed_root_group,
        },
        permissions::{get_permissions_for_user, replace_manual_permissions},
        users::{get_all_users, get_user_by_username, set_user_admin_by_username},
    },
    error::AppError,
    ingest::worker::{SyncSummary, run_sync_for_path},
    state::AppState,
};

fn default_sprint_weekday() -> String {
    "Monday".to_string()
}

fn default_duration_weeks() -> i64 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AdminRootGroupItem {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub gitlab_group_path: String,
    pub has_token: bool,
    pub token_preview: Option<String>,
    pub project_start_date: NaiveDate,
    pub project_end_date: Option<NaiveDate>,
    pub sprint_start_weekday: String,
    pub sprint_duration_weeks: i64,
    pub user_count: usize,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct CreateRootGroupRequest {
    pub slug: String,
    pub name: String,
    pub gitlab_group_path: String,
    pub token: Option<String>,
    pub project_start_date: NaiveDate,
    pub project_end_date: Option<NaiveDate>,
    #[serde(default = "default_sprint_weekday")]
    pub sprint_start_weekday: String,
    #[serde(default = "default_duration_weeks")]
    pub sprint_duration_weeks: i64,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct UpdateRootGroupRequest {
    pub slug: Option<String>,
    pub name: Option<String>,
    pub gitlab_group_path: Option<String>,
    pub token: Option<Option<String>>,
    pub project_start_date: Option<NaiveDate>,
    pub project_end_date: Option<Option<NaiveDate>>,
    pub sprint_start_weekday: Option<String>,
    pub sprint_duration_weeks: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AdminUserPermissionItem {
    pub root_group_id: String,
    pub root_group_slug: String,
    pub root_group_name: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AdminUserItem {
    pub gitlab_id: String,
    pub username: String,
    pub name: String,
    pub custom_display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub web_url: String,
    pub is_admin: bool,
    pub permissions: Vec<AdminUserPermissionItem>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct UpdateUserPermissionsRequest {
    pub is_admin: Option<bool>,
    pub root_group_ids: Option<Vec<String>>,
}

#[utoipa::path(
    get,
    path = "/api/admin/root-groups",
    tag = "Admin",
    responses(
        (status = 200, description = "List all managed root groups with token preview and stats", body = Vec<AdminRootGroupItem>),
        (status = 403, description = "Admin privileges required")
    )
)]
pub async fn list_admin_root_groups(
    _admin: RequireAdmin,
    State(state): State<AppState>,
) -> Result<Json<Vec<AdminRootGroupItem>>, AppError> {
    let roots = get_all_managed_root_groups(&state.db).await?;
    let mut items = Vec::new();

    for r in roots {
        let has_token = r.token.as_ref().map(|t| !t.trim().is_empty()).unwrap_or(false);
        let token_preview = r.token.as_ref().and_then(|t| {
            let t_trim = t.trim();
            if t_trim.is_empty() {
                None
            } else if t_trim.len() <= 8 {
                Some("••••••••".to_string())
            } else {
                Some(format!("{}••••{}", &t_trim[..4], &t_trim[t_trim.len() - 3..]))
            }
        });

        let user_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT user_gitlab_id) FROM user_group_permissions WHERE root_group_id = ?1",
        )
        .bind(&r.id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

        items.push(AdminRootGroupItem {
            id: r.id,
            slug: r.slug,
            name: r.name,
            gitlab_group_path: r.gitlab_group_path,
            has_token,
            token_preview,
            project_start_date: r.project_start_date,
            project_end_date: r.project_end_date,
            sprint_start_weekday: r.sprint_start_weekday,
            sprint_duration_weeks: r.sprint_duration_weeks,
            user_count: user_count as usize,
            created_at: r.created_at,
            updated_at: r.updated_at,
        });
    }

    Ok(Json(items))
}

#[utoipa::path(
    post,
    path = "/api/admin/root-groups",
    tag = "Admin",
    request_body = CreateRootGroupRequest,
    responses(
        (status = 200, description = "Created root group record", body = ManagedRootGroupRecord),
        (status = 400, description = "Invalid slug or path"),
        (status = 403, description = "Admin privileges required")
    )
)]
pub async fn create_root_group_handler(
    _admin: RequireAdmin,
    State(state): State<AppState>,
    Json(payload): Json<CreateRootGroupRequest>,
) -> Result<Json<ManagedRootGroupRecord>, AppError> {
    let clean_slug = payload.slug.trim().to_lowercase();
    let clean_path = payload.gitlab_group_path.trim().trim_matches('/').to_string();

    if clean_slug.is_empty() || clean_path.is_empty() {
        return Err(AppError::BadRequest("Slug and GitLab group path must not be empty".to_string()));
    }

    if !clean_slug.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(AppError::BadRequest("Slug must only contain alphanumeric characters and hyphens".to_string()));
    }

    let id = format!("mrg_{}", uuid::Uuid::new_v4().simple());
    let token = payload.token.as_deref().map(|t| t.trim()).filter(|t| !t.is_empty());

    let record = create_managed_root_group(
        &state.db,
        &id,
        &clean_slug,
        payload.name.trim(),
        &clean_path,
        token,
        payload.project_start_date,
        payload.project_end_date,
        &payload.sprint_start_weekday,
        payload.sprint_duration_weeks.max(1),
    )
    .await?;

    state.cache.clear().await;
    Ok(Json(record))
}

#[utoipa::path(
    put,
    path = "/api/admin/root-groups/{id}",
    tag = "Admin",
    params(
        ("id" = String, Path, description = "Managed root group UUID")
    ),
    request_body = UpdateRootGroupRequest,
    responses(
        (status = 200, description = "Updated root group record", body = ManagedRootGroupRecord),
        (status = 404, description = "Root group not found"),
        (status = 403, description = "Admin privileges required")
    )
)]
pub async fn update_root_group_handler(
    _admin: RequireAdmin,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateRootGroupRequest>,
) -> Result<Json<ManagedRootGroupRecord>, AppError> {
    let token_ref = payload.token.as_ref().map(|opt| opt.as_deref());

    let updated = update_managed_root_group(
        &state.db,
        &id,
        payload.slug.as_deref(),
        payload.name.as_deref(),
        payload.gitlab_group_path.as_deref(),
        token_ref,
        payload.project_start_date,
        payload.project_end_date,
        payload.sprint_start_weekday.as_deref(),
        payload.sprint_duration_weeks,
    )
    .await?;

    state.cache.clear().await;
    Ok(Json(updated))
}

#[utoipa::path(
    delete,
    path = "/api/admin/root-groups/{id}",
    tag = "Admin",
    params(
        ("id" = String, Path, description = "Managed root group UUID")
    ),
    responses(
        (status = 200, description = "Root group deleted successfully"),
        (status = 404, description = "Root group not found"),
        (status = 403, description = "Admin privileges required")
    )
)]
pub async fn delete_root_group_handler(
    _admin: RequireAdmin,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    delete_managed_root_group(&state.db, &id).await?;
    state.cache.clear().await;
    Ok(Json(serde_json::json!({ "deleted": true, "id": id })))
}

#[utoipa::path(
    post,
    path = "/api/admin/root-groups/{id}/sync",
    tag = "Admin",
    params(
        ("id" = String, Path, description = "Managed root group UUID")
    ),
    responses(
        (status = 200, description = "Sync completed for this root group", body = SyncSummary),
        (status = 404, description = "Root group not found"),
        (status = 403, description = "Admin privileges required")
    )
)]
pub async fn sync_root_group_handler(
    _admin: RequireAdmin,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<SyncSummary>, AppError> {
    let root = get_managed_root_group_by_id(&state.db, &id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Managed root group '{id}' not found")))?;

    let summary = run_sync_for_path(
        &state,
        &root.gitlab_group_path,
        root.token.as_deref(),
    )
    .await?;

    Ok(Json(summary))
}

#[utoipa::path(
    get,
    path = "/api/admin/users",
    tag = "Admin",
    responses(
        (status = 200, description = "List all platform users with admin and permission details", body = Vec<AdminUserItem>),
        (status = 403, description = "Admin privileges required")
    )
)]
pub async fn list_admin_users(
    _admin: RequireAdmin,
    State(state): State<AppState>,
) -> Result<Json<Vec<AdminUserItem>>, AppError> {
    let users = get_all_users(&state.db).await?;
    let mut items = Vec::new();

    for u in users {
        let perms = get_permissions_for_user(&state.db, &u.gitlab_id).await.unwrap_or_default();
        let perm_items = perms
            .into_iter()
            .map(|p| AdminUserPermissionItem {
                root_group_id: p.root_group_id,
                root_group_slug: p.root_group_slug,
                root_group_name: p.root_group_name,
                source: p.source,
            })
            .collect();

        items.push(AdminUserItem {
            gitlab_id: u.gitlab_id,
            username: u.username,
            name: u.name,
            custom_display_name: u.custom_display_name,
            avatar_url: u.avatar_url,
            web_url: u.web_url,
            is_admin: u.is_admin,
            permissions: perm_items,
        });
    }

    Ok(Json(items))
}

#[utoipa::path(
    put,
    path = "/api/admin/users/{username}/permissions",
    tag = "Admin",
    params(
        ("username" = String, Path, description = "GitLab username")
    ),
    request_body = UpdateUserPermissionsRequest,
    responses(
        (status = 200, description = "User permissions updated"),
        (status = 404, description = "User not found"),
        (status = 403, description = "Admin privileges required")
    )
)]
pub async fn update_user_permissions_handler(
    _admin: RequireAdmin,
    State(state): State<AppState>,
    Path(username): Path<String>,
    Json(payload): Json<UpdateUserPermissionsRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user = get_user_by_username(&state.db, &username)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User '{username}' not found")))?;

    if let Some(is_admin) = payload.is_admin {
        set_user_admin_by_username(&state.db, &username, is_admin).await?;
    }

    if let Some(target_ids) = payload.root_group_ids {
        replace_manual_permissions(&state.db, &user.gitlab_id, &target_ids).await?;
    }

    state.cache.clear().await;
    Ok(Json(serde_json::json!({ "updated": true, "username": username })))
}
