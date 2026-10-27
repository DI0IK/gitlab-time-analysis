use axum::Router;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

pub mod api;
pub mod cache;
pub mod config;
pub mod db;
pub mod domain;
pub mod error;
pub mod git;
pub mod gitlab;
pub mod ingest;
pub mod session;
pub mod state;
pub mod telemetry;
pub mod web;

use crate::{config::Config, db::init_db, state::AppState};

pub fn app(state: AppState) -> Router {
    let frontend_dist = state.config.frontend_dist.clone();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_router = api::router(state);
    let spa_router = web::spa_router(&frontend_dist);

    Router::new()
        .merge(api_router)
        .merge(spa_router)
        .layer(cors)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
}

pub async fn run() -> anyhow::Result<()> {
    telemetry::init_tracing();

    let config = Config::from_env().map_err(|e| anyhow::anyhow!("{e}"))?;
    let root_groups_str = config
        .root_groups
        .iter()
        .map(|rg| rg.path.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    tracing::info!(
        host = %config.host,
        port = config.port,
        root_groups = %root_groups_str,
        "Starting GitLab Unified Platform v2"
    );

    let db_pool = init_db(&config.database_url).await?;
    let _ = db::managed_root_groups::seed_default_managed_root_groups_if_empty(&db_pool, &config).await;
    let state = AppState::new(config.clone(), db_pool);

    // Start background sync scheduler
    ingest::scheduler::start_scheduler(state.clone());

    let application = app(state);

    let addr_str = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&addr_str).await?;
    let local_addr = listener.local_addr()?;
    tracing::info!("Server listening on http://{local_addr}");

    axum::serve(listener, application).await?;
    Ok(())
}
