use std::collections::HashMap;

use crate::{
    config::Config,
    db::{
        DbPool,
        groups::{GroupRecord, get_all_groups, get_group_members},
        timelogs::get_timelogs_for_group,
        users::get_user_by_username,
        work_items::get_work_items_by_group,
    },
    domain::analytics::{
        comparison::{ComparisonResponse, GroupComparisonSummary},
        dashboard::GroupDashboardResponse,
        distribution::{
            compute_categories, compute_matrix, compute_sprints, compute_weekday_heatmap,
        },
        metrics::{FairnessMetric, MemberMetric},
    },
    error::AppError,
};

fn is_bot_user(username: &str, user: Option<&crate::db::users::UserRecord>) -> bool {
    if user.is_some_and(|u| u.is_bot) {
        return true;
    }
    let lower = username.to_lowercase();
    lower.starts_with("project_")
        || lower.starts_with("group_")
        || lower.contains("_bot")
        || lower.contains("bot_")
        || lower.ends_with("-bot")
        || lower == "automation"
}

pub async fn compute_group_dashboard(
    pool: &DbPool,
    group: &GroupRecord,
    config: Option<&Config>,
) -> Result<GroupDashboardResponse, AppError> {
    let work_items = get_work_items_by_group(pool, &group.id).await?;
    let timelogs = get_timelogs_for_group(pool, &group.id).await?;

    let estimated_seconds: i64 = work_items.iter().map(|w| w.time_estimate).sum();
    let total_seconds: i64 = timelogs.iter().map(|t| t.time_spent).sum();

    let total_hours = (total_seconds as f64 / 3600.0 * 10.0).round() / 10.0;
    let estimated_hours = (estimated_seconds as f64 / 3600.0 * 10.0).round() / 10.0;
    let delta_hours = ((total_hours - estimated_hours) * 10.0).round() / 10.0;
    let accuracy_ratio = if estimated_hours > 0.0 {
        ((total_hours / estimated_hours) * 100.0).round() / 100.0
    } else {
        1.0
    };

    // 1. Group member metrics: only include users with at least 1 timelog in this group and exclude bots
    let mut member_time: HashMap<String, (i64, usize)> = HashMap::new();
    for t in &timelogs {
        let entry = member_time.entry(t.username.clone()).or_insert((0, 0));
        entry.0 += t.time_spent;
        entry.1 += 1;
    }

    let mut member_metrics = Vec::new();

    for (username, (seconds, count)) in member_time {
        if seconds <= 0 || count == 0 {
            continue;
        }

        let user_rec = get_user_by_username(pool, &username).await.ok().flatten();
        if is_bot_user(&username, user_rec.as_ref()) {
            continue;
        }

        let hours = (seconds as f64 / 3600.0 * 10.0).round() / 10.0;
        member_metrics.push(MemberMetric {
            username: username.clone(),
            name: user_rec
                .as_ref()
                .map(|u| u.name.clone())
                .unwrap_or_else(|| username.clone()),
            custom_display_name: user_rec
                .as_ref()
                .and_then(|u| u.custom_display_name.clone()),
            avatar_url: user_rec.and_then(|u| u.avatar_url),
            total_seconds: seconds,
            total_hours: hours,
            effort_multiplier: 1.0,
            work_items_count: 0,
            timelog_count: count,
        });
    }

    // Mean seconds strictly relative to this group's active non-bot contributors
    let active_group_count = member_metrics.len();
    let group_contributors_seconds: i64 = member_metrics.iter().map(|m| m.total_seconds).sum();
    let group_mean_seconds = if active_group_count > 0 {
        group_contributors_seconds as f64 / active_group_count as f64
    } else {
        0.0
    };

    let mut member_hours_list = Vec::new();
    for m in &mut member_metrics {
        let multiplier = if group_mean_seconds > 0.0 {
            ((m.total_seconds as f64 / group_mean_seconds) * 100.0).round() / 100.0
        } else {
            1.0
        };
        m.effort_multiplier = multiplier;
        member_hours_list.push(m.total_hours);
    }

    member_metrics.sort_by_key(|a| std::cmp::Reverse(a.total_seconds));
    let fairness = FairnessMetric::calculate(&member_hours_list);

    // 2. Category distribution
    let categories = compute_categories(&work_items, &timelogs, total_seconds);

    // 3. Sprint progression
    let sprints = compute_sprints(&timelogs);

    // 4. User x Category matrix
    let matrix = compute_matrix(&work_items, &timelogs, &member_metrics);

    let now = chrono::Utc::now();
    let (current_sprint, default_sprint) = if let Some(c) = config {
        crate::ingest::calculate_current_and_default_sprint(
            now,
            c.project_start_date,
            c.sprint_duration_weeks,
        )
    } else {
        (None, None)
    };

    // 5. Weekday x Sprint heatmap
    let total_sprints = config.and_then(|c| match (c.project_start_date, c.project_end_date) {
        (Some(start), Some(end)) => {
            let duration = (c.sprint_duration_weeks.max(1) * 7) as i64;
            let days = (end - start).num_days();
            if days >= 0 {
                Some((days / duration) + 1)
            } else {
                None
            }
        }
        _ => None,
    });
    let start_weekday_str = config.map(|c| c.sprint_start_weekday.as_str());
    let heatmap = compute_weekday_heatmap(
        &timelogs,
        total_sprints,
        start_weekday_str,
        current_sprint,
        Some(now),
    );

    Ok(GroupDashboardResponse {
        group: group.clone(),
        total_seconds,
        total_hours,
        estimated_seconds,
        estimated_hours,
        delta_hours,
        accuracy_ratio,
        fairness,
        members: member_metrics,
        categories,
        sprints,
        matrix,
        heatmap,
        current_sprint,
        default_sprint,
    })
}

pub async fn compute_comparison(pool: &DbPool) -> Result<ComparisonResponse, AppError> {
    let all_groups = get_all_groups(pool).await?;
    let mut summaries = Vec::new();
    let mut cohort_seconds = 0i64;
    let mut group_hours_list = Vec::new();

    for g in all_groups {
        let timelogs = get_timelogs_for_group(pool, &g.id).await?;
        let work_items = get_work_items_by_group(pool, &g.id).await?;
        let mut all_members: std::collections::BTreeSet<String> = get_group_members(pool, &g.id)
            .await?
            .into_iter()
            .map(|m| m.username)
            .collect();
        for t in &timelogs {
            all_members.insert(t.username.clone());
        }
        let member_count = all_members.len();

        let total_secs: i64 = timelogs.iter().map(|t| t.time_spent).sum();
        let est_secs: i64 = work_items.iter().map(|w| w.time_estimate).sum();
        let hours = (total_secs as f64 / 3600.0 * 10.0).round() / 10.0;
        let est_hours = (est_secs as f64 / 3600.0 * 10.0).round() / 10.0;

        let mut member_hours = HashMap::new();
        for t in &timelogs {
            *member_hours.entry(t.username.clone()).or_insert(0f64) += t.time_spent as f64 / 3600.0;
        }
        let member_hours_vec: Vec<f64> = member_hours.into_values().collect();
        let fairness = FairnessMetric::calculate(&member_hours_vec);

        let accuracy = if est_hours > 0.0 {
            ((hours / est_hours) * 100.0).round() / 100.0
        } else {
            1.0
        };

        let categories = compute_categories(&work_items, &timelogs, total_secs);

        summaries.push(GroupComparisonSummary {
            group_id: g.id,
            slug: g.full_path.replace('/', "-"),
            name: g.name,
            level: g.level,
            member_count,
            total_seconds: total_secs,
            total_hours: hours,
            estimated_hours: est_hours,
            accuracy_ratio: accuracy,
            fairness,
            categories,
        });

        cohort_seconds += total_secs;
        group_hours_list.push(hours);
    }

    let cohort_hours = (cohort_seconds as f64 / 3600.0 * 10.0).round() / 10.0;
    let avg_hours = if !summaries.is_empty() {
        (cohort_hours / summaries.len() as f64 * 10.0).round() / 10.0
    } else {
        0.0
    };
    let cohort_fairness = FairnessMetric::calculate(&group_hours_list);

    Ok(ComparisonResponse {
        total_cohort_seconds: cohort_seconds,
        total_cohort_hours: cohort_hours,
        average_group_hours: avg_hours,
        cohort_fairness,
        groups: summaries,
    })
}
