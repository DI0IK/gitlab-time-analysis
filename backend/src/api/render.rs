use axum::{
    extract::{Path, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};

use crate::{
    db::{groups::get_group_by_slug, users::get_user_by_username},
    domain::{
        analytics::engine::compute_group_dashboard,
        gamification::{catalog::all_badges, evaluator::evaluate_user_gamification},
        render::{render_badge_svg, render_group_banner_svg, render_user_card_svg},
    },
    error::AppError,
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/render/badge/{id}.svg",
    tag = "Render",
    params(
        ("id" = String, Path, description = "Badge ID (e.g. 'endurance_1')")
    ),
    responses(
        (status = 200, description = "Rendered SVG badge image", content_type = "image/svg+xml"),
        (status = 404, description = "Badge not found")
    )
)]
pub async fn render_badge(Path(id): Path<String>) -> Result<Response, AppError> {
    let clean_id = id.trim_end_matches(".svg");
    let badge = all_badges()
        .into_iter()
        .find(|b| b.id == clean_id)
        .ok_or_else(|| AppError::NotFound(format!("Badge '{clean_id}' not found")))?;

    let svg = render_badge_svg(&badge);
    let mut resp = (StatusCode::OK, svg).into_response();
    let headers = resp.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        "image/svg+xml; charset=utf-8".parse().unwrap(),
    );
    headers.insert(
        header::CACHE_CONTROL,
        "public, max-age=3600".parse().unwrap(),
    );
    Ok(resp)
}

#[utoipa::path(
    get,
    path = "/api/render/user/{username}.svg",
    tag = "Render",
    params(
        ("username" = String, Path, description = "GitLab username")
    ),
    responses(
        (status = 200, description = "Rendered SVG profile card", content_type = "image/svg+xml"),
        (status = 404, description = "User not found")
    )
)]
pub async fn render_user_card(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Response, AppError> {
    let clean_user = username.trim_end_matches(".svg");
    let user_rec = get_user_by_username(&state.db, clean_user)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User '{clean_user}' not found")))?;

    let summary = evaluate_user_gamification(&state.db, clean_user).await?;
    let svg = render_user_card_svg(&user_rec, &summary);

    let mut resp = (StatusCode::OK, svg).into_response();
    let headers = resp.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        "image/svg+xml; charset=utf-8".parse().unwrap(),
    );
    headers.insert(
        header::CACHE_CONTROL,
        "public, max-age=300".parse().unwrap(),
    );
    Ok(resp)
}

#[utoipa::path(
    get,
    path = "/api/render/group/{slug}.svg",
    tag = "Render",
    params(
        ("slug" = String, Path, description = "Group slug or ID")
    ),
    responses(
        (status = 200, description = "Rendered SVG group summary banner", content_type = "image/svg+xml"),
        (status = 404, description = "Group not found")
    )
)]
pub async fn render_group_banner(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Response, AppError> {
    let clean_slug = slug.trim_end_matches(".svg");
    let group = get_group_by_slug(&state.db, clean_slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group '{clean_slug}' not found")))?;

    let dashboard = compute_group_dashboard(&state.db, &group, Some(&state.config)).await?;
    let svg = render_group_banner_svg(&group, dashboard.total_hours, &dashboard.fairness);

    let mut resp = (StatusCode::OK, svg).into_response();
    let headers = resp.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        "image/svg+xml; charset=utf-8".parse().unwrap(),
    );
    headers.insert(
        header::CACHE_CONTROL,
        "public, max-age=300".parse().unwrap(),
    );
    Ok(resp)
}
