pub mod scheduler;
pub mod sync_groups;
pub mod sync_issues;
pub mod sync_merge_requests;
pub mod sync_mirrors;
pub mod sync_work_items;
pub mod worker;

use crate::state::AppState;
use chrono::{DateTime, Utc};

pub fn calculate_sprint_for_group(
    spent_at: DateTime<Utc>,
    state: &AppState,
    group_full_path: &str,
) -> Option<i64> {
    let root_cfg = state.config.get_root_group_for_path(group_full_path);
    let start_date = root_cfg
        .and_then(|rc| rc.project_start_date)
        .or(state.config.project_start_date)?;
    let duration_weeks = root_cfg
        .map(|rc| rc.sprint_duration_weeks)
        .unwrap_or(state.config.sprint_duration_weeks);

    let spent_date = spent_at.date_naive();
    let days = (spent_date - start_date).num_days();
    if days < 0 {
        return None;
    }
    let duration_days = (duration_weeks.max(1) * 7) as i64;
    Some((days / duration_days) + 1)
}

pub fn calculate_sprint(spent_at: DateTime<Utc>, state: &AppState) -> Option<i64> {
    calculate_sprint_for_group(spent_at, state, "")
}

pub fn calculate_current_and_default_sprint(
    now: DateTime<Utc>,
    start_date: Option<chrono::NaiveDate>,
    duration_weeks: u32,
) -> (Option<i64>, Option<i64>) {
    let start = match start_date {
        Some(s) => s,
        None => return (None, None),
    };
    let today = now.date_naive();
    let days = (today - start).num_days();
    if days < 0 {
        return (Some(1), Some(1));
    }
    let duration_days = (duration_weeks.max(1) * 7) as i64;
    let this_sprint = (days / duration_days) + 1;
    let day_in_sprint = days % duration_days;

    // Default to this sprint / last sprint if today is first day of next sprint
    let default_sprint = if day_in_sprint == 0 && this_sprint > 1 {
        this_sprint - 1
    } else {
        this_sprint
    };

    (Some(this_sprint), Some(default_sprint))
}
