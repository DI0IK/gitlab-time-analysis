use axum::{
    Router,
    middleware::{from_fn, from_fn_with_state},
    routing::{get, post},
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::{api::openapi::ApiDoc, state::AppState};

pub mod activity;
pub mod analytics;
pub mod auth;
pub mod extractors;
pub mod groups;
pub mod health;
pub mod leaderboard;
pub mod meta;
pub mod middleware;
pub mod notes;
pub mod openapi;
pub mod profile;
pub mod render;
pub mod repo;
pub mod sync;
pub mod wiki;

pub fn router(state: AppState) -> Router {
    let openapi_doc = ApiDoc::openapi();

    let public_routes = Router::new()
        .route("/health", get(health::health_check))
        .route("/meta", get(meta::get_meta))
        .route("/auth/login", get(auth::login))
        .route("/auth/callback", get(auth::callback))
        .route("/auth/me", get(auth::me))
        .route("/auth/logout", post(auth::logout))
        .route("/render/badge/:id", get(render::render_badge))
        .route("/render/user/:username", get(render::render_user_card))
        .route("/render/group/:slug", get(render::render_group_banner));

    let protected_routes = Router::new()
        .route(
            "/user/profile",
            get(profile::get_profile).patch(profile::update_profile),
        )
        .route(
            "/users/:username/gamification",
            get(profile::get_user_gamification),
        )
        .route(
            "/users/:username/details",
            get(profile::get_user_profile_details),
        )
        .route("/groups", get(groups::list_groups))
        .route("/groups/:slug", get(groups::get_group))
        .route("/groups/:slug/members", get(groups::list_members))
        .route("/groups/:slug/activity", get(activity::get_group_activity))
        .route(
            "/groups/:slug/dashboard",
            get(analytics::get_group_dashboard),
        )
        .route(
            "/groups/:slug/work-items",
            get(analytics::get_group_work_items),
        )
        .route(
            "/groups/:slug/merge-requests",
            get(analytics::get_group_merge_requests),
        )
        .route(
            "/groups/:slug/repositories",
            get(analytics::get_group_repositories),
        )
        .route("/notes", get(notes::get_item_notes))
        .route(
            "/groups/:slug/wiki/targets",
            get(wiki::get_group_wiki_targets),
        )
        .route(
            "/groups/:slug/leaderboard",
            get(leaderboard::get_group_leaderboard),
        )
        .route("/comparison", get(analytics::get_cohort_comparison))
        .route("/leaderboard", get(leaderboard::get_cohort_leaderboard))
        .route("/repo/branches", get(repo::list_branches))
        .route("/repo/tree", get(repo::get_tree))
        .route("/repo/blob", get(repo::get_blob))
        .route("/repo/commits", get(repo::list_commits))
        .route("/repo/sync", post(repo::trigger_repo_sync))
        .route("/wiki/pages", get(wiki::list_wiki_pages))
        .route("/wiki/page", get(wiki::get_wiki_page))
        .route("/wiki/history", get(wiki::get_wiki_history))
        .route("/sync", post(sync::trigger_sync))
        .route("/sync/status", get(sync::sync_status))
        .route_layer(from_fn_with_state(
            state.clone(),
            middleware::require_auth,
        ));

    let api_routes = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(from_fn(middleware::security_headers))
        .with_state(state);

    let swagger_routes = SwaggerUi::new("/swagger-ui").url("/api/openapi.json", openapi_doc);

    Router::new().nest("/api", api_routes).merge(swagger_routes)
}
