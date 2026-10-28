use std::collections::{BTreeMap, HashMap, HashSet};

use crate::{
    db::timelogs::TimelogRecord,
    domain::analytics::metrics::{DeadlineRushMetric, SprintDeadlineRush, SprintMetric},
};

pub fn compute_sprints(timelogs: &[TimelogRecord]) -> Vec<SprintMetric> {
    let mut sprint_map: BTreeMap<i64, (i64, HashSet<String>)> = BTreeMap::new();
    for t in timelogs {
        let s_num = t.sprint_number.unwrap_or(1);
        let entry = sprint_map.entry(s_num).or_default();
        entry.0 += t.time_spent;
        entry.1.insert(t.username.clone());
    }

    let mut cumulative = 0.0;
    sprint_map
        .into_iter()
        .map(|(num, (secs, users))| {
            let hours = (secs as f64 / 3600.0 * 10.0).round() / 10.0;
            cumulative = ((cumulative + hours) * 10.0).round() / 10.0;
            SprintMetric {
                sprint_number: num,
                total_seconds: secs,
                total_hours: hours,
                cumulative_hours: cumulative,
                active_members: users.len(),
            }
        })
        .collect()
}

pub fn compute_deadline_rush(
    timelogs: &[TimelogRecord],
    project_start_date: Option<chrono::NaiveDate>,
    sprint_duration_weeks: u32,
) -> DeadlineRushMetric {
    let mut sprint_totals: HashMap<i64, (i64, i64)> = HashMap::new();

    for t in timelogs {
        let sprint_num = t.sprint_number.unwrap_or(1);
        let entry = sprint_totals.entry(sprint_num).or_insert((0, 0));
        entry.1 += t.time_spent;

        let is_rush = if let Some(start) = project_start_date {
            let duration_days = (sprint_duration_weeks.max(1) * 7) as i64;
            let sprint_end_date = start + chrono::Duration::days(sprint_num * duration_days);
            let sprint_end_dt = sprint_end_date.and_hms_opt(23, 59, 59).map(|naive| {
                chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(naive, chrono::Utc)
            });
            if let Some(end_dt) = sprint_end_dt {
                let rush_start_dt = end_dt - chrono::Duration::hours(48);
                t.spent_at >= rush_start_dt && t.spent_at <= end_dt
            } else {
                false
            }
        } else {
            false
        };

        if is_rush {
            entry.0 += t.time_spent;
        }
    }

    let mut sorted_sprints: Vec<i64> = sprint_totals.keys().copied().collect();
    sorted_sprints.sort_unstable();

    let mut sprints = Vec::new();
    let mut overall_rush_secs = 0i64;
    let mut overall_total_secs = 0i64;

    for s_num in sorted_sprints {
        let (rush_s, tot_s) = sprint_totals[&s_num];
        overall_rush_secs += rush_s;
        overall_total_secs += tot_s;
        let rush_h = (rush_s as f64 / 3600.0 * 10.0).round() / 10.0;
        let tot_h = (tot_s as f64 / 3600.0 * 10.0).round() / 10.0;
        let pct = if tot_s > 0 {
            ((rush_s as f64 / tot_s as f64) * 100.0).round()
        } else {
            0.0
        };
        sprints.push(SprintDeadlineRush {
            sprint_number: s_num,
            rush_hours: rush_h,
            total_hours: tot_h,
            rush_percentage: pct,
        });
    }

    let overall_rush_hours = (overall_rush_secs as f64 / 3600.0 * 10.0).round() / 10.0;
    let overall_total_hours = (overall_total_secs as f64 / 3600.0 * 10.0).round() / 10.0;
    let rush_percentage = if overall_total_secs > 0 {
        ((overall_rush_secs as f64 / overall_total_secs as f64) * 100.0).round()
    } else {
        0.0
    };

    let (rating, explanation) = match rush_percentage {
        pct if pct <= 20.0 => (
            "Steady Execution".to_string(),
            "Workload is distributed steadily without severe deadline crunch.".to_string(),
        ),
        pct if pct <= 40.0 => (
            "Moderate Rush".to_string(),
            "Normal sprint wrap-up intensity in the final 48 hours.".to_string(),
        ),
        _ => (
            "Deadline Crunch".to_string(),
            "Significant concentration of work logged in the final 48 hours.".to_string(),
        ),
    };

    DeadlineRushMetric {
        overall_rush_hours,
        overall_total_hours,
        rush_percentage,
        rating,
        explanation,
        sprints,
    }
}
