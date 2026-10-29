pub mod protocol;
pub mod resources;
pub mod session;
pub mod tools;
pub mod transport;

use axum::{
    Router,
    routing::{get, post},
};

use crate::state::AppState;

pub fn router(app_state: AppState) -> Router {
    Router::new()
        .route("/mcp/sse", get(transport::handle_sse))
        .route("/mcp/messages", post(transport::handle_message))
        .with_state(app_state)
}
