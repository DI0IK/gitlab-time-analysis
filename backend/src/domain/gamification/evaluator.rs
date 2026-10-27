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

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BadgeProgressItem {
    pub id: String,
    pub track: String,
    pub title: String,
    pub description: String,
    pub threshold: u64,
    pub current_value: u64,
    pub progress_pct: f32,
    pub is_unlocked: bool,
    pub reward_xp: u64,
    pub icon: String,
}

#[derive(Debug, Clone)]
pub struct UserContributionStats {
    pub total_hours: f64,
    pub total_seconds: i64,
    pub timelog_count: usize,
    pub streak_days: u32,
    pub merged_mrs_count: i64,
    pub reviews_count: i64,
    pub closed_wi_count: i64,
    pub max_closed_est_hours: f64,
    pub total_closed_est_hours: u64,
    pub sharp_shooter_count: i64,
    pub sprint_count: u64,
}

pub async fn fetch_user_contribution_stats(
    pool: &DbPool,
    username: &str,
) -> Result<
    (
        UserContributionStats,
        Vec<crate::db::timelogs::TimelogRecord>,
    ),
    AppError,
> {
    fetch_user_contribution_stats_scoped(pool, username, None).await
}

pub async fn fetch_user_contribution_stats_scoped(
    pool: &DbPool,
    username: &str,
    managed_root: Option<&crate::db::managed_root_groups::ManagedRootGroupRecord>,
) -> Result<
    (
        UserContributionStats,
        Vec<crate::db::timelogs::TimelogRecord>,
    ),
    AppError,
> {
    let raw_timelogs = get_timelogs_by_user(pool, username).await?;

    let timelogs: Vec<crate::db::timelogs::TimelogRecord> = if let Some(mr) = managed_root {
        let prefix = format!("{}/%", mr.gitlab_group_path.trim_matches('/'));
        let exact = mr.gitlab_group_path.trim_matches('/').to_string();

        let mut filtered = Vec::new();
        for mut t in raw_timelogs {
            let d = t.spent_at.date_naive();
            if d < mr.project_start_date {
                continue;
            }
            if let Some(end) = mr.project_end_date {
                if d > end {
                    continue;
                }
            }

            let is_under_root: bool = sqlx::query_scalar(
                r#"
                SELECT EXISTS(
                    SELECT 1 FROM work_items wi
                    WHERE wi.id = ?1 AND (
                        wi.group_id IN (SELECT id FROM groups WHERE full_path = ?2 OR full_path LIKE ?3)
                        OR wi.project_path = ?2 OR wi.project_path LIKE ?3
                    )
                    UNION
                    SELECT 1 FROM merge_requests m
                    WHERE m.id = ?4 AND (m.project_path = ?2 OR m.project_path LIKE ?3)
                )
                "#,
            )
            .bind(&t.work_item_id)
            .bind(&exact)
            .bind(&prefix)
            .bind(&t.merge_request_id)
            .fetch_one(pool)
            .await
            .unwrap_or(true);

            if is_under_root {
                t.sprint_number = crate::ingest::calculate_sprint_dynamic(
                    t.spent_at,
                    mr.project_start_date,
                    mr.sprint_duration_weeks,
                );
                filtered.push(t);
            }
        }
        filtered
    } else {
        raw_timelogs
    };

    let total_seconds: i64 = timelogs.iter().map(|t| t.time_spent).sum();
    let total_hours = (total_seconds as f64 / 3600.0 * 10.0).round() / 10.0;

    let mut active_days = HashSet::new();
    for t in &timelogs {
        let d = t.spent_at.date_naive();
        active_days.insert((d.year(), d.ordinal()));
    }
    let streak_days = active_days.len() as u32;

    let (
        merged_mrs_count,
        reviews_count,
        closed_wi_count,
        max_closed_est_secs,
        total_closed_est_secs,
        sharp_shooter_count,
    ) = if let Some(mr) = managed_root {
        let prefix = format!("{}/%", mr.gitlab_group_path.trim_matches('/'));
        let exact = mr.gitlab_group_path.trim_matches('/').to_string();

        let merged_mrs: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM merge_requests WHERE author_username = ?1 AND state = 'merged' AND (project_path = ?2 OR project_path LIKE ?3)"
        )
        .bind(username)
        .bind(&exact)
        .bind(&prefix)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let user_pat = format!("%\"{username}\"%");
        let reviews: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM merge_requests WHERE author_username != ?1 AND (approved_by_json LIKE ?2 OR discussion_authors_json LIKE ?2) AND (project_path = ?3 OR project_path LIKE ?4)"
        )
        .bind(username)
        .bind(&user_pat)
        .bind(&exact)
        .bind(&prefix)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let closed_wi: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT wi.id) FROM work_items wi JOIN timelogs t ON t.work_item_id = wi.id WHERE t.username = ?1 AND wi.state = 'closed' AND (wi.project_path = ?2 OR wi.project_path LIKE ?3 OR wi.group_id IN (SELECT id FROM groups WHERE full_path = ?2 OR full_path LIKE ?3))"
        )
        .bind(username)
        .bind(&exact)
        .bind(&prefix)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let max_est: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(wi.time_estimate), 0) FROM work_items wi JOIN timelogs t ON t.work_item_id = wi.id WHERE t.username = ?1 AND wi.state = 'closed' AND (wi.project_path = ?2 OR wi.project_path LIKE ?3 OR wi.group_id IN (SELECT id FROM groups WHERE full_path = ?2 OR full_path LIKE ?3))"
        )
        .bind(username)
        .bind(&exact)
        .bind(&prefix)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let total_est: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(wi.time_estimate), 0) FROM work_items wi WHERE wi.state = 'closed' AND (wi.project_path = ?2 OR wi.project_path LIKE ?3 OR wi.group_id IN (SELECT id FROM groups WHERE full_path = ?2 OR full_path LIKE ?3)) AND wi.id IN (SELECT DISTINCT work_item_id FROM timelogs WHERE username = ?1)"
        )
        .bind(username)
        .bind(&exact)
        .bind(&prefix)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let sharp: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM work_items wi WHERE wi.state = 'closed' AND wi.time_estimate >= 3600 AND wi.total_time_spent >= (wi.time_estimate * 0.9) AND wi.total_time_spent <= (wi.time_estimate * 1.1) AND (wi.project_path = ?2 OR wi.project_path LIKE ?3 OR wi.group_id IN (SELECT id FROM groups WHERE full_path = ?2 OR full_path LIKE ?3)) AND wi.id IN (SELECT DISTINCT work_item_id FROM timelogs WHERE username = ?1)"
        )
        .bind(username)
        .bind(&exact)
        .bind(&prefix)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        (merged_mrs, reviews, closed_wi, max_est, total_est, sharp)
    } else {
        let merged_mrs: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM merge_requests WHERE author_username = ?1 AND state = 'merged'",
        )
        .bind(username)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let user_pat = format!("%\"{username}\"%");
        let reviews: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM merge_requests WHERE author_username != ?1 AND (approved_by_json LIKE ?2 OR discussion_authors_json LIKE ?2)",
        )
        .bind(username)
        .bind(&user_pat)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let closed_wi: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT wi.id) FROM work_items wi JOIN timelogs t ON t.work_item_id = wi.id WHERE t.username = ?1 AND wi.state = 'closed'",
        )
        .bind(username)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let max_est: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(wi.time_estimate), 0) FROM work_items wi JOIN timelogs t ON t.work_item_id = wi.id WHERE t.username = ?1 AND wi.state = 'closed'",
        )
        .bind(username)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let total_est: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(wi.time_estimate), 0) FROM work_items wi WHERE wi.state = 'closed' AND wi.id IN (SELECT DISTINCT work_item_id FROM timelogs WHERE username = ?1)",
        )
        .bind(username)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let sharp: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM work_items wi WHERE wi.state = 'closed' AND wi.time_estimate >= 3600 AND wi.total_time_spent >= (wi.time_estimate * 0.9) AND wi.total_time_spent <= (wi.time_estimate * 1.1) AND wi.id IN (SELECT DISTINCT work_item_id FROM timelogs WHERE username = ?1)",
        )
        .bind(username)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        (merged_mrs, reviews, closed_wi, max_est, total_est, sharp)
    };

    let max_closed_est_hours = max_closed_est_secs as f64 / 3600.0;
    let total_closed_est_hours = (total_closed_est_secs as f64 / 3600.0) as u64;

    let distinct_sprints: HashSet<i64> = timelogs.iter().filter_map(|t| t.sprint_number).collect();
    let sprint_count = distinct_sprints.len() as u64;

    let stats = UserContributionStats {
        total_hours,
        total_seconds,
        timelog_count: timelogs.len(),
        streak_days,
        merged_mrs_count,
        reviews_count,
        closed_wi_count,
        max_closed_est_hours,
        total_closed_est_hours,
        sharp_shooter_count,
        sprint_count,
    };

    Ok((stats, timelogs))
}

pub fn evaluate_badges_progress(
    stats: &UserContributionStats,
) -> (Vec<BadgeMeta>, Vec<BadgeProgressItem>, u64) {
    let all = all_badges();
    let mut unlocked = Vec::new();
    let mut all_progress = Vec::with_capacity(all.len());
    let mut badge_xp = 0u64;

    for b in all {
        let (current_value, is_unlocked) = match b.track.as_str() {
            "Endurance" => {
                let cur = stats.total_hours as u64;
                (cur, cur >= b.threshold)
            }
            "Velocity" => {
                let cur = stats.total_closed_est_hours;
                (cur, cur >= b.threshold)
            }
            "Consistency" => {
                let cur = stats.streak_days as u64;
                (cur, cur >= b.threshold)
            }
            "Cadence" => {
                let cur = stats.timelog_count as u64;
                (cur, cur >= b.threshold)
            }
            "Shipping" => {
                let cur = stats.merged_mrs_count as u64;
                (cur, cur >= b.threshold)
            }
            "Quality" => {
                let cur = stats.reviews_count as u64;
                (cur, cur >= b.threshold)
            }
            "Momentum" => {
                if b.id.starts_with("momentum_streak") {
                    let cur = stats.streak_days as u64;
                    (cur, cur >= b.threshold)
                } else {
                    let cur = stats.sprint_count;
                    (cur, cur >= b.threshold)
                }
            }
            "Achievement" => match b.id.as_str() {
                "achievement_first_steps" => {
                    let cur = (stats.closed_wi_count as u64).min(1);
                    (cur, stats.closed_wi_count >= 1)
                }
                "achievement_pr_pioneer" => {
                    let cur = (stats.merged_mrs_count as u64).min(1);
                    (cur, stats.merged_mrs_count >= 1)
                }
                "achievement_team_player" => {
                    let cur = stats.reviews_count as u64;
                    (cur, stats.reviews_count >= 3)
                }
                "achievement_sharp_shooter" => {
                    let cur = (stats.sharp_shooter_count as u64).min(1);
                    (cur, stats.sharp_shooter_count >= 1)
                }
                "achievement_heavy_lifter" => {
                    let cur = stats.max_closed_est_hours as u64;
                    (cur, stats.max_closed_est_hours >= 8.0)
                }
                "achievement_colossal_lifter" => {
                    let cur = stats.max_closed_est_hours as u64;
                    (cur, stats.max_closed_est_hours >= 10.0)
                }
                "achievement_titan_lifter" => {
                    let cur = stats.max_closed_est_hours as u64;
                    (cur, stats.max_closed_est_hours >= 12.0)
                }
                _ => (0, false),
            },
            _ => (0, false),
        };

        let progress_pct = if b.threshold > 0 {
            ((current_value as f32 / b.threshold as f32) * 100.0).min(100.0)
        } else if is_unlocked {
            100.0
        } else {
            0.0
        };

        if is_unlocked {
            badge_xp += b.reward_xp;
            unlocked.push(b.clone());
        }

        all_progress.push(BadgeProgressItem {
            id: b.id,
            track: b.track,
            title: b.title,
            description: b.description,
            threshold: b.threshold,
            current_value,
            progress_pct,
            is_unlocked,
            reward_xp: b.reward_xp,
            icon: b.icon,
        });
    }

    (unlocked, all_progress, badge_xp)
}

pub async fn evaluate_user_gamification(
    pool: &DbPool,
    username: &str,
) -> Result<UserGamificationSummary, AppError> {
    evaluate_user_gamification_scoped(pool, username, None).await
}

pub async fn evaluate_user_gamification_scoped(
    pool: &DbPool,
    username: &str,
    managed_root: Option<&crate::db::managed_root_groups::ManagedRootGroupRecord>,
) -> Result<UserGamificationSummary, AppError> {
    let user_rec = get_user_by_username(pool, username)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User '{username}' not found")))?;

    let (stats, _timelogs) =
        fetch_user_contribution_stats_scoped(pool, username, managed_root).await?;
    let (unlocked, _all_progress, badge_xp) = evaluate_badges_progress(&stats);

    let base_xp = (stats.total_hours * 10.0) as u64 + (stats.timelog_count as u64 * 2);
    let total_xp = base_xp + badge_xp;
    let level_progress = calculate_level(total_xp);

    Ok(UserGamificationSummary {
        username: user_rec.username,
        name: user_rec.name,
        custom_display_name: user_rec.custom_display_name,
        avatar_url: user_rec.avatar_url,
        level_progress,
        unlocked_badges: unlocked,
        total_hours: stats.total_hours,
        total_seconds: stats.total_seconds,
        streak_days: stats.streak_days,
    })
}

pub async fn compute_leaderboard(
    pool: &DbPool,
    group_id: Option<&str>,
) -> Result<Vec<LeaderboardEntry>, AppError> {
    compute_leaderboard_scoped(pool, group_id, None).await
}

pub async fn compute_leaderboard_scoped(
    pool: &DbPool,
    group_id: Option<&str>,
    managed_root: Option<&crate::db::managed_root_groups::ManagedRootGroupRecord>,
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
    } else if let Some(mr) = managed_root {
        let prefix = format!("{}/%", mr.gitlab_group_path.trim_matches('/'));
        let exact = mr.gitlab_group_path.trim_matches('/');
        let rows = sqlx::query_scalar::<_, String>(
            r#"
            SELECT DISTINCT username FROM (
                SELECT username FROM group_members gm
                JOIN groups g ON gm.group_id = g.id
                WHERE g.full_path = ?1 OR g.full_path LIKE ?2
                UNION
                SELECT t.username FROM timelogs t
                LEFT JOIN work_items wi ON t.work_item_id = wi.id
                LEFT JOIN merge_requests mr ON t.merge_request_id = mr.id
                WHERE (wi.project_path = ?1 OR wi.project_path LIKE ?2 OR mr.project_path = ?1 OR mr.project_path LIKE ?2)
            )
            "#,
        )
        .bind(exact)
        .bind(&prefix)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        rows
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
        if let Ok(eval) = evaluate_user_gamification_scoped(pool, &uname, managed_root).await {
            if managed_root.is_some() && eval.total_seconds == 0 && eval.unlocked_badges.is_empty()
            {
                // If scoped to a semester and user has no tracked time in this semester, skip from leaderboard
                continue;
            }
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
