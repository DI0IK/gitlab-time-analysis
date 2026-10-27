use axum::{
    extract::{Request, State},
    http::{HeaderValue, header},
    middleware::Next,
    response::Response,
};

use crate::{
    db::sessions::get_session_with_user,
    error::AppError,
    session::{SESSION_COOKIE_NAME, extract_cookie},
    state::AppState,
};

pub async fn require_auth(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = extract_cookie(req.headers(), SESSION_COOKIE_NAME)
        .ok_or_else(|| AppError::Unauthorized("Authentication required".to_string()))?;

    let (_session, _user) = get_session_with_user(&state.db, &token)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Invalid or expired session".to_string()))?;

    Ok(next.run(req).await)
}

pub async fn security_headers(req: Request, next: Next) -> Response {
    let mut response = next.run(req).await;

    let headers = response.headers_mut();
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::X_FRAME_OPTIONS,
        HeaderValue::from_static("SAMEORIGIN"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );

    response
}
