use axum::{
    Json,
    extract::{Path, Query, State},
    response::IntoResponse,
};

use crate::{
    api::{
        extractors::{AuthUser, OptionalAuthUser, verify_root_access},
        repo::{
            RepoBlobQuery, RepoBranch, RepoCommit, RepoCommitsQuery, RepoFileContent,
            RepoProjectQuery, RepoTreeItem, RepoTreeQuery,
        },
        tenant::guard::verify_project_under_root,
    },
    error::AppError,
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/{root_slug}/repo/branches",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        RepoProjectQuery
    ),
    responses(
        (status = 200, description = "List git branches in project repository", body = Vec<RepoBranch>),
        (status = 403, description = "Forbidden")
    )
)]
pub async fn get_root_repo_branches(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
    Query(query): Query<RepoProjectQuery>,
) -> Result<Json<Vec<RepoBranch>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    verify_project_under_root(&root, &query.project)?;
    crate::api::repo::list_branches(State(state), OptionalAuthUser(Some(auth)), Query(query)).await
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/repo/tree",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        RepoTreeQuery
    ),
    responses(
        (status = 200, description = "List files/directories in tree", body = Vec<RepoTreeItem>),
        (status = 403, description = "Forbidden")
    )
)]
pub async fn get_root_repo_tree(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
    Query(query): Query<RepoTreeQuery>,
) -> Result<Json<Vec<RepoTreeItem>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    verify_project_under_root(&root, &query.project)?;
    crate::api::repo::get_tree(State(state), OptionalAuthUser(Some(auth)), Query(query)).await
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/repo/blob",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        RepoBlobQuery
    ),
    responses(
        (status = 200, description = "File content blob", body = RepoFileContent),
        (status = 403, description = "Forbidden")
    )
)]
pub async fn get_root_repo_blob(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
    Query(query): Query<RepoBlobQuery>,
) -> Result<Json<RepoFileContent>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    verify_project_under_root(&root, &query.project)?;
    crate::api::repo::get_blob(State(state), OptionalAuthUser(Some(auth)), Query(query)).await
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/repo/commits",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        RepoCommitsQuery
    ),
    responses(
        (status = 200, description = "Recent commits list", body = Vec<RepoCommit>),
        (status = 403, description = "Forbidden")
    )
)]
pub async fn get_root_repo_commits(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
    Query(query): Query<RepoCommitsQuery>,
) -> Result<Json<Vec<RepoCommit>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    verify_project_under_root(&root, &query.project)?;
    crate::api::repo::list_commits(State(state), OptionalAuthUser(Some(auth)), Query(query)).await
}

#[utoipa::path(
    post,
    path = "/api/{root_slug}/repo/sync",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        RepoProjectQuery
    ),
    responses(
        (status = 200, description = "Triggered bare repo mirror sync"),
        (status = 403, description = "Forbidden")
    )
)]
pub async fn trigger_root_repo_sync(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
    Query(query): Query<RepoProjectQuery>,
) -> Result<impl IntoResponse, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    verify_project_under_root(&root, &query.project)?;
    crate::api::repo::trigger_repo_sync(State(state), OptionalAuthUser(Some(auth)), Query(query)).await
}
