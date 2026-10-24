use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

use chrono::Datelike;

use crate::{
    db::{timelogs::TimelogRecord, work_items::WorkItemRecord},
    domain::{
        analytics::metrics::{
            CategoryDistribution, MemberMetric, SprintMetric, UserCategoryMatrixRow,
            WeekdayHeatmapCell, WeekdaySprintHeatmap,
        },
        categories::{CategoryId, all_categories},
    },
};

pub fn resolve_work_item_categories(work_items: &[WorkItemRecord]) -> HashMap<String, CategoryId> {
    let mut item_map: HashMap<&str, &WorkItemRecord> = HashMap::new();
    let mut work_item_cat: HashMap<String, CategoryId> = HashMap::new();

    let category_priority = |cat: &CategoryId| -> u8 {
        match cat {
            CategoryId::ProjectManagement => 1,
            CategoryId::RequirementsEngineering => 2,
            CategoryId::Implementation => 3,
            CategoryId::Architecture => 4,
            CategoryId::Other => 5,
        }
    };

    // First pass: resolve direct categories with priority PM -> RE -> Impl -> Arch -> Other
    for w in work_items {
        item_map.insert(&w.id, w);
        let mut best_cat = CategoryId::Other;
        if let Ok(labels) = serde_json::from_str::<Vec<serde_json::Value>>(&w.labels_json) {
            for l in labels {
                if let Some(title) = l.get("title").and_then(|t| t.as_str()) {
                    let c = CategoryId::match_label(title);
                    if category_priority(&c) < category_priority(&best_cat) {
                        best_cat = c;
                    }
                }
            }
        }
        work_item_cat.insert(w.id.clone(), best_cat);
    }

    // Second pass: inherit from parent work item if direct category is Other
    for w in work_items {
        if work_item_cat.get(&w.id) == Some(&CategoryId::Other) {
            let mut curr_parent_id = w.parent_id.as_deref();
            let mut depth = 0;
            while let Some(pid) = curr_parent_id {
                if depth > 10 {
                    break;
                }
                if let Some(parent_cat) =
                    work_item_cat.get(pid).filter(|c| **c != CategoryId::Other)
                {
                    work_item_cat.insert(w.id.clone(), parent_cat.clone());
                    break;
                }
                curr_parent_id = item_map.get(pid).and_then(|pw| pw.parent_id.as_deref());
                depth += 1;
            }
        }
    }

    work_item_cat
}

pub fn compute_categories(
    work_items: &[WorkItemRecord],
    timelogs: &[TimelogRecord],
    total_seconds: i64,
) -> Vec<CategoryDistribution> {
    let work_item_cat = resolve_work_item_categories(work_items);

    let mut cat_seconds: HashMap<CategoryId, i64> = HashMap::new();
    for t in timelogs {
        let cat = t
            .work_item_id
            .as_ref()
            .and_then(|wid| work_item_cat.get(wid))
            .cloned()
            .unwrap_or(CategoryId::Other);
        *cat_seconds.entry(cat).or_insert(0) += t.time_spent;
    }

    let cat_meta_list = all_categories();
    cat_meta_list
        .into_iter()
        .map(|meta| {
            let cid = match meta.id.as_str() {
                "project-management" => CategoryId::ProjectManagement,
                "requirements-engineering" => CategoryId::RequirementsEngineering,
                "implementation" => CategoryId::Implementation,
                "architecture" => CategoryId::Architecture,
                _ => CategoryId::Other,
            };
            let secs = cat_seconds.get(&cid).copied().unwrap_or(0);
            let hours = (secs as f64 / 3600.0 * 10.0).round() / 10.0;
            let pct = if total_seconds > 0 {
                ((secs as f64 / total_seconds as f64) * 1000.0).round() / 10.0
            } else {
                0.0
            };
            CategoryDistribution {
                category_id: cid,
                label: meta.label,
                short_code: meta.short_code,
                color: meta.color,
                total_seconds: secs,
                total_hours: hours,
                percentage: pct,
            }
        })
        .collect()
}

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

pub fn compute_matrix(
    work_items: &[WorkItemRecord],
    timelogs: &[TimelogRecord],
    members: &[MemberMetric],
) -> Vec<UserCategoryMatrixRow> {
    let work_item_cat = resolve_work_item_categories(work_items);

    let mut sprint_numbers: BTreeSet<i64> = BTreeSet::new();
    let mut breakdown: HashMap<(String, Option<i64>, CategoryId), i64> = HashMap::new();

    for t in timelogs {
        let s_num = t.sprint_number.unwrap_or(1);
        sprint_numbers.insert(s_num);

        let cat = t
            .work_item_id
            .as_ref()
            .and_then(|wid| work_item_cat.get(wid))
            .cloned()
            .unwrap_or(CategoryId::Other);

        *breakdown
            .entry((t.username.clone(), Some(s_num), cat.clone()))
            .or_insert(0) += t.time_spent;
        *breakdown
            .entry((t.username.clone(), None, cat))
            .or_insert(0) += t.time_spent;
    }

    let mut sprint_options: Vec<Option<i64>> = vec![None];
    for s in sprint_numbers {
        sprint_options.push(Some(s));
    }

    let to_hours = |secs: i64| (secs as f64 / 3600.0 * 10.0).round() / 10.0;
    let mut rows = Vec::new();

    for sprint_opt in sprint_options {
        for m in members {
            let get_hrs = |cid: CategoryId| {
                let secs = breakdown
                    .get(&(m.username.clone(), sprint_opt, cid))
                    .copied()
                    .unwrap_or(0);
                to_hours(secs)
            };

            let pm = get_hrs(CategoryId::ProjectManagement);
            let re = get_hrs(CategoryId::RequirementsEngineering);
            let imp = get_hrs(CategoryId::Implementation);
            let arch = get_hrs(CategoryId::Architecture);
            let other = get_hrs(CategoryId::Other);
            let total = ((pm + re + imp + arch + other) * 10.0).round() / 10.0;

            rows.push(UserCategoryMatrixRow {
                username: m.username.clone(),
                name: m.name.clone(),
                custom_display_name: m.custom_display_name.clone(),
                avatar_url: m.avatar_url.clone(),
                sprint_number: sprint_opt,
                pm_hours: pm,
                re_hours: re,
                impl_hours: imp,
                arch_hours: arch,
                other_hours: other,
                total_hours: total,
            });
        }
    }

    rows
}

pub fn compute_weekday_heatmap(
    timelogs: &[TimelogRecord],
    total_sprints: Option<i64>,
    sprint_start_weekday: Option<&str>,
    current_sprint: Option<i64>,
    now: Option<chrono::DateTime<chrono::Utc>>,
) -> WeekdaySprintHeatmap {
    let start_name = sprint_start_weekday.unwrap_or("Monday");
    let start_num: u32 = match start_name.to_lowercase().trim() {
        "monday" | "mon" | "1" => 1,
        "tuesday" | "tue" | "2" => 2,
        "wednesday" | "wed" | "3" => 3,
        "thursday" | "thu" | "4" => 4,
        "friday" | "fri" | "5" => 5,
        "saturday" | "sat" | "6" => 6,
        "sunday" | "sun" | "7" => 7,
        _ => 1,
    };
    let cycle_weekdays: Vec<u32> = (0..7).map(|i| (start_num + i - 1) % 7 + 1).collect();
    let today_weekday = now.map(|n| n.weekday().number_from_monday());

    let mut day_sprint_map: HashMap<(i64, u32), (i64, usize)> = HashMap::new();
    let mut total_seconds: i64 = 0;
    let mut max_sprint: i64 = total_sprints.unwrap_or(1);

    for t in timelogs {
        let s_num = t.sprint_number.unwrap_or(1);
        if s_num > max_sprint {
            max_sprint = s_num;
        }
        let weekday = t.spent_at.weekday().number_from_monday(); // 1 = Mon, 7 = Sun
        let entry = day_sprint_map.entry((s_num, weekday)).or_insert((0, 0));
        entry.0 += t.time_spent;
        entry.1 += 1;
        total_seconds += t.time_spent;
    }

    max_sprint = max_sprint.max(1);
    let sorted_sprints: Vec<i64> = (1..=max_sprint).collect();
    let weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let mut cells = Vec::new();
    let mut max_hours = 0.0f64;

    for &s_num in &sorted_sprints {
        for &weekday in &cycle_weekdays {
            let (secs, count) = day_sprint_map
                .get(&(s_num, weekday))
                .copied()
                .unwrap_or((0, 0));
            let hours = (secs as f64 / 3600.0 * 10.0).round() / 10.0;
            if hours > max_hours {
                max_hours = hours;
            }
            let is_current_day = Some(s_num) == current_sprint && today_weekday == Some(weekday);
            cells.push(WeekdayHeatmapCell {
                sprint_number: s_num,
                weekday,
                weekday_name: weekday_names[(weekday - 1) as usize].to_string(),
                total_seconds: secs,
                total_hours: hours,
                timelog_count: count,
                is_current_day,
            });
        }
    }

    let total_hours = (total_seconds as f64 / 3600.0 * 10.0).round() / 10.0;
    let full_weekday_names = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ];
    let canonical_start_name = full_weekday_names[(start_num - 1) as usize].to_string();

    WeekdaySprintHeatmap {
        cells,
        max_hours,
        total_hours,
        sprint_numbers: sorted_sprints,
        sprint_start_weekday: canonical_start_name,
    }
}
