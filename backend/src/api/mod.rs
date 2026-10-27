use axum::{
    Router,
    middleware::{from_fn, from_fn_with_state},
    routing::{get, post, put},
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::{api::openapi::ApiDoc, state::AppState};

pub mod activity;
pub mod admin;
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
pub mod tenant;
pub mod wiki;

pub fn router(state: AppState) -> Router {
    let openapi_doc = ApiDoc::openapi();

    let public_routes = Router::new()
        .route("/health", get(health::health_check))
        .route("/meta", get(meta::get_meta))
        .route("/roots", get(tenant::list_roots))
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
        // Platform Administration
        .route(
            "/admin/root-groups",
            get(admin::list_admin_root_groups).post(admin::create_root_group_handler),
        )
        .route(
            "/admin/root-groups/:id",
            put(admin::update_root_group_handler).delete(admin::delete_root_group_handler),
        )
        .route(
            "/admin/root-groups/:id/sync",
            post(admin::sync_root_group_handler),
        )
        .route("/admin/users", get(admin::list_admin_users))
        .route(
            "/admin/users/:username/permissions",
            put(admin::update_user_permissions_handler),
        )
        // Multi-Tenant Scoped APIs
        .route("/:root_slug/groups", get(tenant::get_root_groups))
        .route(
            "/:root_slug/groups/:group_slug/members",
            get(tenant::get_root_group_members),
        )
        .route(
            "/:root_slug/groups/:group_slug/dashboard",
            get(tenant::get_root_group_dashboard),
        )
        .route(
            "/:root_slug/groups/:group_slug/activity",
            get(tenant::get_root_group_activity),
        )
        .route(
            "/:root_slug/groups/:group_slug/leaderboard",
            get(tenant::get_root_group_leaderboard),
        )
        .route(
            "/:root_slug/groups/:group_slug/work-items",
            get(tenant::get_root_group_work_items),
        )
        .route(
            "/:root_slug/groups/:group_slug/merge-requests",
            get(tenant::get_root_group_merge_requests),
        )
        .route(
            "/:root_slug/groups/:group_slug/repositories",
            get(tenant::get_root_group_repositories),
        )
        .route(
            "/:root_slug/groups/:group_slug/wiki/targets",
            get(tenant::get_root_group_wiki_targets),
        )
        .route(
            "/:root_slug/users/:username",
            get(tenant::get_root_user_profile),
        )
        .route(
            "/:root_slug/leaderboard",
            get(tenant::get_root_cohort_leaderboard),
        )
        .route(
            "/:root_slug/comparison",
            get(tenant::get_root_cohort_comparison),
        )
        // Multi-Tenant Scoped Notes, Repositories & Wiki
        .route("/:root_slug/notes", get(tenant::get_root_notes))
        .route("/:root_slug/repo/branches", get(tenant::get_root_repo_branches))
        .route("/:root_slug/repo/tree", get(tenant::get_root_repo_tree))
        .route("/:root_slug/repo/blob", get(tenant::get_root_repo_blob))
        .route("/:root_slug/repo/commits", get(tenant::get_root_repo_commits))
        .route("/:root_slug/repo/sync", post(tenant::trigger_root_repo_sync))
        .route("/:root_slug/wiki/pages", get(tenant::get_root_wiki_pages))
        .route("/:root_slug/wiki/page", get(tenant::get_root_wiki_page))
        .route("/:root_slug/wiki/history", get(tenant::get_root_wiki_history))
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
