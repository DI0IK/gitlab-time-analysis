use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use utoipa::ToSchema;

use crate::{
    db::{
        DbPool,
        groups::get_group_members,
        timelogs::{get_timelogs_by_user, get_timelogs_for_group},
        users::{get_all_users, get_user_by_username},
    },
    domain::gamification::{
        catalog::{BadgeMeta, all_badges},
        levels::{LevelProgress, calculate_level},
    },
    error::AppError,
};

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UserGamificationSummary {
    pub username: String,
    pub name: String,
    pub custom_display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub level_progress: LevelProgress,
    pub unlocked_badges: Vec<BadgeMeta>,
    pub total_hours: f64,
    pub total_seconds: i64,
    pub streak_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LeaderboardEntry {
    pub rank: usize,
    pub username: String,
    pub name: String,
    pub custom_display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub level: u32,
    pub tier_name: String,
    pub tier_color: String,
    pub current_xp: u64,
    pub progress_pct: f32,
    pub total_hours: f64,
    pub badges_count: usize,
    pub badge_icons: Vec<String>,
}

pub async fn evaluate_user_gamification(
    pool: &DbPool,
    username: &str,
) -> Result<UserGamificationSummary, AppError> {
    let user_rec = get_user_by_username(pool, username)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User '{username}' not found")))?;

    let timelogs = get_timelogs_by_user(pool, username).await?;
    let total_seconds: i64 = timelogs.iter().map(|t| t.time_spent).sum();
    let total_hours = (total_seconds as f64 / 3600.0 * 10.0).round() / 10.0;

    let mut active_days = HashSet::new();
    for t in &timelogs {
        let d = t.spent_at.date_naive();
        active_days.insert((d.year(), d.ordinal()));
    }
    let streak_days = active_days.len() as u32;

    // Real contribution stats for badges
    let merged_mrs_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM merge_requests WHERE author_username = ?1 AND state = 'merged'",
    )
    .bind(username)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let user_pat = format!("%\"{username}\"%");
    let reviews_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM merge_requests WHERE author_username != ?1 AND (approved_by_json LIKE ?2 OR discussion_authors_json LIKE ?2)",
    )
    .bind(username)
    .bind(&user_pat)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let closed_wi_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT wi.id) FROM work_items wi JOIN timelogs t ON t.work_item_id = wi.id WHERE t.username = ?1 AND wi.state = 'closed'",
    )
    .bind(username)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let max_closed_est_secs: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(wi.time_estimate), 0) FROM work_items wi JOIN timelogs t ON t.work_item_id = wi.id WHERE t.username = ?1 AND wi.state = 'closed'",
    )
    .bind(username)
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    let max_closed_est_hours = max_closed_est_secs as f64 / 3600.0;

    let total_closed_est_secs: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(wi.time_estimate), 0) FROM work_items wi WHERE wi.state = 'closed' AND wi.id IN (SELECT DISTINCT work_item_id FROM timelogs WHERE username = ?1)",
    )
    .bind(username)
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    let total_closed_est_hours = (total_closed_est_secs as f64 / 3600.0) as u64;

    let sharp_shooter_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM work_items wi WHERE wi.state = 'closed' AND wi.time_estimate >= 3600 AND wi.total_time_spent >= (wi.time_estimate * 0.9) AND wi.total_time_spent <= (wi.time_estimate * 1.1) AND wi.id IN (SELECT DISTINCT work_item_id FROM timelogs WHERE username = ?1)",
    )
    .bind(username)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let distinct_sprints: HashSet<i64> = timelogs.iter().filter_map(|t| t.sprint_number).collect();
    let sprint_count = distinct_sprints.len() as u64;

    let all = all_badges();
    let mut unlocked = Vec::new();
    let mut badge_xp = 0u64;

    for b in all {
        let is_unlocked = match b.track.as_str() {
            "Endurance" => (total_hours as u64) >= b.threshold,
            "Velocity" => total_closed_est_hours >= b.threshold,
            "Consistency" => streak_days as u64 >= b.threshold,
            "Cadence" => timelogs.len() as u64 >= b.threshold,
            "Shipping" => (merged_mrs_count as u64) >= b.threshold,
            "Quality" => (reviews_count as u64) >= b.threshold,
            "Momentum" => sprint_count >= b.threshold,
            "Achievement" => match b.id.as_str() {
                "achievement_first_steps" => closed_wi_count >= 1,
                "achievement_pr_pioneer" => merged_mrs_count >= 1,
                "achievement_team_player" => reviews_count >= 3,
                "achievement_sharp_shooter" => sharp_shooter_count >= 1,
                "achievement_heavy_lifter" => max_closed_est_hours >= 8.0,
                "achievement_colossal_lifter" => max_closed_est_hours >= 10.0,
                "achievement_titan_lifter" => max_closed_est_hours >= 12.0,
                _ => false,
            },
            _ => false,
        };

        if is_unlocked {
            badge_xp += b.reward_xp;
            unlocked.push(b);
        }
    }

    let base_xp = (total_hours * 10.0) as u64 + (timelogs.len() as u64 * 2);
    let total_xp = base_xp + badge_xp;
    let level_progress = calculate_level(total_xp);

    Ok(UserGamificationSummary {
        username: user_rec.username,
        name: user_rec.name,
        custom_display_name: user_rec.custom_display_name,
        avatar_url: user_rec.avatar_url,
        level_progress,
        unlocked_badges: unlocked,
        total_hours,
        total_seconds,
        streak_days,
    })
}

pub async fn compute_leaderboard(
    pool: &DbPool,
    group_id: Option<&str>,
) -> Result<Vec<LeaderboardEntry>, AppError> {
    let usernames: Vec<String> = if let Some(gid) = group_id {
        let mut set: std::collections::BTreeSet<String> = get_group_members(pool, gid)
            .await?
            .into_iter()
            .map(|m| m.username)
            .collect();
        let logs = get_timelogs_for_group(pool, gid).await?;
        for t in logs {
            set.insert(t.username);
        }
        set.into_iter().collect()
    } else {
        let users = get_all_users(pool).await?;
        users
            .into_iter()
            .filter(|u| !u.is_bot)
            .map(|u| u.username)
            .collect()
    };

    let mut entries = Vec::new();
    for uname in usernames {
        if let Ok(eval) = evaluate_user_gamification(pool, &uname).await {
            let icons = eval
                .unlocked_badges
                .iter()
                .map(|b| b.icon.clone())
                .collect();
            entries.push((eval, icons));
        }
    }

    // Sort by level desc, then XP desc, then hours desc
    entries.sort_by(|a, b| {
        b.0.level_progress
            .level
            .cmp(&a.0.level_progress.level)
            .then_with(|| {
                b.0.level_progress
                    .current_xp
                    .cmp(&a.0.level_progress.current_xp)
            })
            .then_with(|| b.0.total_seconds.cmp(&a.0.total_seconds))
    });

    let ranked = entries
        .into_iter()
        .enumerate()
        .map(|(idx, (eval, icons))| LeaderboardEntry {
            rank: idx + 1,
            username: eval.username,
            name: eval.name,
            custom_display_name: eval.custom_display_name,
            avatar_url: eval.avatar_url,
            level: eval.level_progress.level,
            tier_name: eval.level_progress.tier_name,
            tier_color: eval.level_progress.tier_color,
            current_xp: eval.level_progress.current_xp,
            progress_pct: eval.level_progress.progress_pct,
            total_hours: eval.total_hours,
            badges_count: eval.unlocked_badges.len(),
            badge_icons: icons,
        })
        .collect();

    Ok(ranked)
}
