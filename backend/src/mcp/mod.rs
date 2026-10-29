pub mod protocol;
pub mod resources;
pub mod session;
pub mod tools;
pub mod transport;

use axum::{Router, routing::get};

use crate::state::AppState;

pub fn router(app_state: AppState) -> Router {
    Router::new()
        .route(
            "/mcp",
            get(transport::handle_sse).post(transport::handle_message),
        )
        .route(
            "/mcp/",
            get(transport::handle_sse).post(transport::handle_message),
        )
        .route(
            "/mcp/sse",
            get(transport::handle_sse).post(transport::handle_message),
        )
        .route(
            "/mcp/messages",
            get(transport::handle_sse).post(transport::handle_message),
        )
        .with_state(app_state)
}
