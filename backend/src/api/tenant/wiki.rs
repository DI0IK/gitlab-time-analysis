use axum::{
    Json,
    extract::{Path, Query, State},
};

use crate::{
    api::{
        extractors::{AuthUser, OptionalAuthUser, verify_root_access},
        tenant::guard::verify_project_under_root,
        wiki::{WikiHistoryQuery, WikiPageQuery, WikiPagesQuery},
    },
    error::AppError,
    git::wiki_reader::{WikiPageContent, WikiPageItem},
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/{root_slug}/wiki/pages",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        WikiPagesQuery
    ),
    responses(
        (status = 200, description = "List wiki pages", body = Vec<WikiPageItem>),
        (status = 403, description = "Forbidden")
    )
)]
pub async fn get_root_wiki_pages(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
    Query(query): Query<WikiPagesQuery>,
) -> Result<Json<Vec<WikiPageItem>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    verify_project_under_root(&root, &query.project)?;
    crate::api::wiki::list_wiki_pages(State(state), OptionalAuthUser(Some(auth)), Query(query)).await
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/wiki/page",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        WikiPageQuery
    ),
    responses(
        (status = 200, description = "Get wiki page content", body = WikiPageContent),
        (status = 403, description = "Forbidden")
    )
)]
pub async fn get_root_wiki_page(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
    Query(query): Query<WikiPageQuery>,
) -> Result<Json<WikiPageContent>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    verify_project_under_root(&root, &query.project)?;
    crate::api::wiki::get_wiki_page(State(state), OptionalAuthUser(Some(auth)), Query(query)).await
}

#[utoipa::path(
    get,
    path = "/api/{root_slug}/wiki/history",
    tag = "Tenant",
    params(
        ("root_slug" = String, Path, description = "Root group tenant slug"),
        WikiHistoryQuery
    ),
    responses(
        (status = 200, description = "Get wiki history commits", body = Vec<crate::api::repo::RepoCommit>),
        (status = 403, description = "Forbidden")
    )
)]
pub async fn get_root_wiki_history(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(root_slug): Path<String>,
    Query(query): Query<WikiHistoryQuery>,
) -> Result<Json<Vec<crate::api::repo::RepoCommit>>, AppError> {
    let root = verify_root_access(&state.db, &auth.user, &root_slug).await?;
    verify_project_under_root(&root, &query.project)?;
    crate::api::wiki::get_wiki_history(State(state), OptionalAuthUser(Some(auth)), Query(query)).await
}
