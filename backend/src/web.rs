use axum::Router;
use std::path::PathBuf;
use tower_http::services::{ServeDir, ServeFile};

pub fn spa_router(frontend_dist: &str) -> Router {
    let dist_path = PathBuf::from(frontend_dist);
    let index_file = dist_path.join("index.html");

    let serve_dir = ServeDir::new(&dist_path).fallback(ServeFile::new(index_file));

    Router::new().fallback_service(serve_dir)
}
