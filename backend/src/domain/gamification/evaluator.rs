use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use utoipa::ToSchema;

use crate::{
    db::{
        DbPool,
        groups::get_group_members,
        timelogs::{get_timelogs_by_user, get_timelogs_for_group},
        users::{get_all_users, get_user_by_username},
    },
    domain::{
        categories::CategoryId,
        gamification::{
            catalog::{BadgeMeta, all_badges},
            levels::{LevelProgress, calculate_level},
        },
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
    pub longest_sprint_streak: u64,
    pub distinct_teammates_reviewed: u64,
    pub total_active_teammates: u64,
    pub is_bot: bool,
    pub bot_actions_count: u64,
    pub full_stack_sprint_unlocked: bool,
    pub team_player_unlocked: bool,
    pub community_pillar_unlocked: bool,
    pub base_xp: u64,
}

fn longest_consecutive_run(sorted_sprints: &[i64]) -> u64 {
    if sorted_sprints.is_empty() {
        return 0;
    }
    let mut max_run = 1;
    let mut current_run = 1;
    for i in 1..sorted_sprints.len() {
        if sorted_sprints[i] == sorted_sprints[i - 1] + 1 {
            current_run += 1;
            if current_run > max_run {
                max_run = current_run;
            }
        } else if sorted_sprints[i] != sorted_sprints[i - 1] {
            current_run = 1;
        }
    }
    max_run
}

fn is_protected_branch(branch: &str) -> bool {
    let b = branch.to_lowercase();
    matches!(
        b.as_str(),
        "main" | "master" | "develop" | "developer" | "production"
    ) || b.starts_with("release")
}

#[derive(Deserialize)]
struct ApproverObj {
    username: String,
}

fn parse_approvers(json_str: &str) -> HashSet<String> {
    if let Ok(objs) = serde_json::from_str::<Vec<ApproverObj>>(json_str) {
        return objs
            .into_iter()
            .map(|o| o.username.to_lowercase())
            .collect();
    }
    if let Ok(strings) = serde_json::from_str::<Vec<String>>(json_str) {
        return strings.into_iter().map(|s| s.to_lowercase()).collect();
    }
    HashSet::new()
}

fn parse_discussion_authors(json_str: &str) -> HashSet<String> {
    serde_json::from_str::<Vec<String>>(json_str)
        .unwrap_or_default()
        .into_iter()
        .map(|s| s.to_lowercase())
        .collect()
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
    let lower_user = username.to_lowercase();
    let user_rec = get_user_by_username(pool, username).await?;
    let is_bot = crate::domain::analytics::engine::is_bot_user(username, user_rec.as_ref());

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
            if mr.project_end_date.is_some_and(|end| d > end) {
                continue;
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
    let hours_xp = (total_hours * 20.0).floor() as u64;

    let mut active_days = HashSet::new();
    let mut sprint_hours_map: HashMap<i64, f64> = HashMap::new();
    for t in &timelogs {
        let d = t.spent_at.date_naive();
        active_days.insert((d.year(), d.ordinal()));
        if let Some(sp) = t.sprint_number {
            *sprint_hours_map.entry(sp).or_default() += t.time_spent as f64 / 3600.0;
        }
    }
    let streak_days = active_days.len() as u32;

    let mut active_sprints: Vec<i64> = sprint_hours_map.keys().copied().collect();
    active_sprints.sort_unstable();
    let sprint_count = active_sprints.len() as u64;
    let longest_sprint_streak = longest_consecutive_run(&active_sprints);
    let sprints_xp = sprint_count * 25;

    // Full-Stack Sprint: >= 1h across all 4 categories in a single sprint
    let work_item_ids: HashSet<String> = timelogs
        .iter()
        .filter_map(|t| t.work_item_id.clone())
        .collect();
    let mut wi_labels_map: HashMap<String, Vec<String>> = HashMap::new();
    if !work_item_ids.is_empty() {
        let id_list: Vec<String> = work_item_ids.into_iter().collect();
        for chunk in id_list.chunks(200) {
            let placeholders = chunk.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let q = format!("SELECT id, labels_json FROM work_items WHERE id IN ({placeholders})");
            let mut query = sqlx::query_as::<_, (String, String)>(&q);
            for id in chunk {
                query = query.bind(id);
            }
            if let Ok(rows) = query.fetch_all(pool).await {
                for (id, labels_json) in rows {
                    let labels: Vec<String> =
                        serde_json::from_str(&labels_json).unwrap_or_default();
                    wi_labels_map.insert(id, labels);
                }
            }
        }
    }

    let mut sprint_category_hours: HashMap<i64, HashMap<&'static str, f64>> = HashMap::new();
    for t in &timelogs {
        if let Some(sprint_num) = t.sprint_number
            && let Some(wi_id) = &t.work_item_id
            && let Some(labels) = wi_labels_map.get(wi_id)
        {
            let mut matched_cat = None;
            for label in labels {
                let cat = CategoryId::match_label(label);
                if cat != CategoryId::Other {
                    matched_cat = Some(cat.as_str());
                    break;
                }
            }
            if let Some(cat_str) = matched_cat {
                let cat_map = sprint_category_hours.entry(sprint_num).or_default();
                *cat_map.entry(cat_str).or_default() += t.time_spent as f64 / 3600.0;
            }
        }
    }

    let full_stack_sprint_unlocked = sprint_category_hours.values().any(|cats| {
        cats.get("project-management").copied().unwrap_or(0.0) >= 1.0
            && cats.get("requirements-engineering").copied().unwrap_or(0.0) >= 1.0
            && cats.get("implementation").copied().unwrap_or(0.0) >= 1.0
            && cats.get("architecture").copied().unwrap_or(0.0) >= 1.0
    });

    // Closed work items user contributed to
    let closed_work_items: Vec<(String, i64, i64, i64)> = if let Some(mr) = managed_root {
        let prefix = format!("{}/%", mr.gitlab_group_path.trim_matches('/'));
        let exact = mr.gitlab_group_path.trim_matches('/').to_string();
        sqlx::query_as(
            r#"
            SELECT 
                wi.id,
                wi.time_estimate,
                COALESCE((SELECT SUM(time_spent) FROM timelogs WHERE work_item_id = wi.id AND username = ?1), 0) AS user_time,
                COALESCE((SELECT SUM(time_spent) FROM timelogs WHERE work_item_id = wi.id), 0) AS total_time
            FROM work_items wi
            WHERE wi.state = 'closed'
              AND (wi.project_path = ?2 OR wi.project_path LIKE ?3 OR wi.group_id IN (SELECT id FROM groups WHERE full_path = ?2 OR full_path LIKE ?3))
              AND wi.id IN (SELECT DISTINCT work_item_id FROM timelogs WHERE username = ?1 AND work_item_id IS NOT NULL)
            "#,
        )
        .bind(username)
        .bind(&exact)
        .bind(&prefix)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as(
            r#"
            SELECT 
                wi.id,
                wi.time_estimate,
                COALESCE((SELECT SUM(time_spent) FROM timelogs WHERE work_item_id = wi.id AND username = ?1), 0) AS user_time,
                COALESCE((SELECT SUM(time_spent) FROM timelogs WHERE work_item_id = wi.id), 0) AS total_time
            FROM work_items wi
            WHERE wi.state = 'closed'
              AND wi.id IN (SELECT DISTINCT work_item_id FROM timelogs WHERE username = ?1 AND work_item_id IS NOT NULL)
            "#,
        )
        .bind(username)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    };

    let closed_wi_count = closed_work_items.len() as i64;
    let mut total_closed_estimate_seconds = 0.0;
    let mut max_estimate_share_hours = 0.0;
    let mut sharp_shooter_count = 0i64;
    let mut issues_xp = 0u64;
    let mut blind_flight_penalty = 0u64;

    for (_id, estimate, user_time, total_time) in closed_work_items {
        if total_time <= 0 {
            continue;
        }
        let share = user_time as f64 / total_time as f64;
        if estimate > 0 {
            let total_issue_xp = ((estimate as f64 / 3600.0) * 15.0).floor() as u64;
            issues_xp += (share * total_issue_xp as f64).floor() as u64;

            let share_secs = share * estimate as f64;
            total_closed_estimate_seconds += share_secs;

            let share_hours = share_secs / 3600.0;
            if share_hours > max_estimate_share_hours {
                max_estimate_share_hours = share_hours;
            }

            let diff_pct = ((total_time - estimate).abs() as f64) / (estimate as f64);
            if diff_pct <= 0.1 {
                sharp_shooter_count += 1;
            }
        } else {
            blind_flight_penalty += (share * 30.0).floor() as u64;
        }
    }

    let total_closed_est_hours = (total_closed_estimate_seconds / 3600.0) as u64;
    let max_closed_est_hours = max_estimate_share_hours;

    // Merge requests analysis
    let merge_requests = if let Some(mr) = managed_root {
        let prefix = format!("{}/%", mr.gitlab_group_path.trim_matches('/'));
        let exact = mr.gitlab_group_path.trim_matches('/').to_string();
        sqlx::query_as::<_, crate::db::merge_requests::MergeRequestRecord>(
            r#"
            SELECT id, project_path, iid, title, description, state, author_username,
                   source_branch, target_branch, additions, deletions, pipeline_status,
                   web_url, approved_by_json, discussion_authors_json, discussion_count,
                   created_at, merged_at, closed_at, synced_at
            FROM merge_requests
            WHERE project_path = ?1 OR project_path LIKE ?2
            "#,
        )
        .bind(&exact)
        .bind(&prefix)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as::<_, crate::db::merge_requests::MergeRequestRecord>(
            r#"
            SELECT id, project_path, iid, title, description, state, author_username,
                   source_branch, target_branch, additions, deletions, pipeline_status,
                   web_url, approved_by_json, discussion_authors_json, discussion_count,
                   created_at, merged_at, closed_at, synced_at
            FROM merge_requests
            "#,
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    };

    let merged_mrs_count = merge_requests
        .iter()
        .filter(|mr| {
            mr.author_username.to_lowercase() == lower_user
                && mr.state == "merged"
                && is_protected_branch(&mr.target_branch)
                && !is_protected_branch(&mr.source_branch)
        })
        .count() as i64;
    let merges_xp = (merged_mrs_count as u64) * 50;

    let mut approved_mrs_count = 0u64;
    let mut commented_only_mrs_count = 0u64;
    let mut approved_teammates = HashSet::new();
    let mut commented_teammates = HashSet::new();

    for mr in &merge_requests {
        let author_lower = mr.author_username.to_lowercase();
        if author_lower == lower_user {
            continue;
        }
        let approvers = parse_approvers(&mr.approved_by_json);
        let is_approver = approvers.contains(&lower_user);
        if is_approver {
            approved_mrs_count += 1;
            approved_teammates.insert(author_lower);
        } else {
            let commenters = parse_discussion_authors(&mr.discussion_authors_json);
            if commenters.contains(&lower_user) {
                commented_only_mrs_count += 1;
                commented_teammates.insert(author_lower);
            }
        }
    }

    let reviews_count = (approved_mrs_count + commented_only_mrs_count) as i64;
    let reviews_xp = (approved_mrs_count * 15) + (commented_only_mrs_count * 10);

    let mut unique_teammates_reviewed = approved_teammates;
    unique_teammates_reviewed.extend(commented_teammates);

    let active_usernames: Vec<String> = if let Some(mr) = managed_root {
        let exact = mr.gitlab_group_path.trim_matches('/').to_string();
        let prefix = format!("{}/%", exact);
        let start_date = mr.project_start_date.to_string();
        let end_date = mr.project_end_date.map(|d| d.to_string());

        sqlx::query_scalar::<_, String>(
            r#"
            SELECT DISTINCT t.username 
            FROM timelogs t
            LEFT JOIN work_items wi ON t.work_item_id = wi.id
            LEFT JOIN merge_requests m ON t.merge_request_id = m.id
            WHERE (
                wi.project_path = ?1 OR wi.project_path LIKE ?2 
                OR wi.group_id IN (SELECT id FROM groups WHERE full_path = ?1 OR full_path LIKE ?2)
                OR m.project_path = ?1 OR m.project_path LIKE ?2
            )
            AND date(t.spent_at) >= date(?3)
            AND (?4 IS NULL OR date(t.spent_at) <= date(?4))
            AND t.time_spent > 0
            "#,
        )
        .bind(&exact)
        .bind(&prefix)
        .bind(&start_date)
        .bind(&end_date)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT username FROM timelogs WHERE time_spent > 0",
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    };

    let mut active_teammates: HashSet<String> = HashSet::new();
    for u in active_usernames {
        let user_rec = get_user_by_username(pool, &u).await.ok().flatten();
        if !crate::domain::analytics::engine::is_bot_user(&u, user_rec.as_ref()) {
            active_teammates.insert(u.to_lowercase());
        }
    }

    let other_active_teammates: HashSet<String> = active_teammates
        .into_iter()
        .filter(|u| u != &lower_user)
        .collect();

    if !other_active_teammates.is_empty() {
        unique_teammates_reviewed.retain(|t| other_active_teammates.contains(t));
    }
    let distinct_teammates_reviewed = unique_teammates_reviewed.len() as u64;
    let total_active_teammates = other_active_teammates.len() as u64;

    let team_player_unlocked =
        total_active_teammates > 0 && distinct_teammates_reviewed >= 3.min(total_active_teammates);
    let community_pillar_unlocked =
        total_active_teammates > 0 && distinct_teammates_reviewed >= total_active_teammates;

    let bot_actions_count = merge_requests
        .iter()
        .map(|mr| mr.discussion_count as u64)
        .sum::<u64>();
    let bot_actions_xp = if is_bot { bot_actions_count * 2 } else { 0 };

    let base_xp = (hours_xp + issues_xp + sprints_xp + reviews_xp + merges_xp + bot_actions_xp)
        .saturating_sub(blind_flight_penalty);

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
        longest_sprint_streak,
        distinct_teammates_reviewed,
        total_active_teammates,
        is_bot,
        bot_actions_count,
        full_stack_sprint_unlocked,
        team_player_unlocked,
        community_pillar_unlocked,
        base_xp,
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
                    let cur = stats.longest_sprint_streak;
                    (cur, cur >= b.threshold)
                } else {
                    let cur = stats.sprint_count;
                    (cur, cur >= b.threshold)
                }
            }
            "Automation" => {
                if stats.is_bot {
                    let cur = stats.bot_actions_count;
                    (cur, cur >= b.threshold)
                } else {
                    (0, false)
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
                    let cur = stats.distinct_teammates_reviewed;
                    (cur, stats.team_player_unlocked)
                }
                "achievement_community_pillar" => {
                    let cur = if stats.total_active_teammates > 0 {
                        ((stats.distinct_teammates_reviewed as f32
                            / stats.total_active_teammates as f32)
                            * 100.0)
                            .round() as u64
                    } else {
                        0
                    };
                    (cur.min(100), stats.community_pillar_unlocked)
                }
                "achievement_full_stack_sprint" => {
                    let cur = if stats.full_stack_sprint_unlocked {
                        1
                    } else {
                        0
                    };
                    (cur, stats.full_stack_sprint_unlocked)
                }
                "achievement_sharp_shooter" => {
                    let cur = (stats.sharp_shooter_count as u64).min(1);
                    (cur, stats.sharp_shooter_count >= 1)
                }
                "achievement_heavy_lifter" => {
                    let cur = stats.max_closed_est_hours.round() as u64;
                    (cur, stats.max_closed_est_hours >= 8.0)
                }
                "achievement_colossal_lifter" => {
                    let cur = stats.max_closed_est_hours.round() as u64;
                    (cur, stats.max_closed_est_hours >= 10.0)
                }
                "achievement_titan_lifter" => {
                    let cur = stats.max_closed_est_hours.round() as u64;
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

    let base_xp = stats.base_xp;
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
        sqlx::query_scalar::<_, String>(
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
        .unwrap_or_default()
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
