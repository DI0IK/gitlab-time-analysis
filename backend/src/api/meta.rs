use axum::{Json, extract::State, response::IntoResponse};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    domain::{
        categories::{CategoryMeta, all_categories},
        gamification::{
            catalog::{BadgeMeta, all_badges},
            levels::{TierMeta, all_tiers},
        },
    },
    error::AppError,
    state::AppState,
};

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FeatureFlags {
    pub oauth_enabled: bool,
    pub work_items_mutation_enabled: bool,
    pub repo_browser_enabled: bool,
    pub mr_suite_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RootGroupMeta {
    pub path: String,
    pub project_start_date: Option<chrono::NaiveDate>,
    pub project_end_date: Option<chrono::NaiveDate>,
    pub sprint_duration_weeks: u32,
    pub sprint_start_weekday: String,
    pub current_sprint: Option<i64>,
    pub default_sprint: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MetaResponse {
    pub categories: Vec<CategoryMeta>,
    pub tiers: Vec<TierMeta>,
    pub badges: Vec<BadgeMeta>,
    pub features: FeatureFlags,
    pub root_groups: Vec<String>,
    pub root_groups_meta: Vec<RootGroupMeta>,
    pub group_path: String,
    pub gitlab_domain: String,
    pub sprint_duration_weeks: u32,
    pub sprint_start_weekday: String,
    pub current_sprint: Option<i64>,
    pub default_sprint: Option<i64>,
}

#[utoipa::path(
    get,
    path = "/api/meta",
    tag = "Meta",
    responses(
        (status = 200, description = "Static application taxonomy, tier thresholds, badge catalogs, and feature flags", body = MetaResponse)
    )
)]
pub async fn get_meta(State(state): State<AppState>) -> Result<impl IntoResponse, AppError> {
    let oauth_enabled = state.config.gitlab_oauth_client_id.is_some()
        && state.config.gitlab_oauth_client_secret.is_some();

    let now = chrono::Utc::now();
    let (current_sprint, default_sprint) = crate::ingest::calculate_current_and_default_sprint(
        now,
        state.config.project_start_date,
        state.config.sprint_duration_weeks,
    );

    let root_groups_meta: Vec<RootGroupMeta> = state
        .config
        .root_groups
        .iter()
        .map(|rg| {
            let start = rg.project_start_date.or(state.config.project_start_date);
            let end = rg.project_end_date.or(state.config.project_end_date);
            let (cur, def) = crate::ingest::calculate_current_and_default_sprint(
                now,
                start,
                rg.sprint_duration_weeks,
            );
            RootGroupMeta {
                path: rg.path.clone(),
                project_start_date: start,
                project_end_date: end,
                sprint_duration_weeks: rg.sprint_duration_weeks,
                sprint_start_weekday: rg.sprint_start_weekday.clone(),
                current_sprint: cur,
                default_sprint: def,
            }
        })
        .collect();

    let root_groups: Vec<String> = state
        .config
        .root_groups
        .iter()
        .map(|rg| rg.path.clone())
        .collect();
    let group_path = root_groups.first().cloned().unwrap_or_default();

    let response = MetaResponse {
        categories: all_categories(),
        tiers: all_tiers(),
        badges: all_badges(),
        features: FeatureFlags {
            oauth_enabled,
            work_items_mutation_enabled: oauth_enabled,
            repo_browser_enabled: true,
            mr_suite_enabled: true,
        },
        root_groups,
        root_groups_meta,
        group_path,
        gitlab_domain: state.config.gitlab_domain.clone(),
        sprint_duration_weeks: state.config.sprint_duration_weeks,
        sprint_start_weekday: state.config.sprint_start_weekday.clone(),
        current_sprint,
        default_sprint,
    };

    Ok(Json(response))
}
