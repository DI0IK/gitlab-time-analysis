use std::collections::{BTreeMap, HashMap};

use crate::{
    db::{timelogs::TimelogRecord, work_items::WorkItemRecord},
    domain::{
        analytics::metrics::{CategoryDistribution, CategorySprintShift},
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

pub fn compute_category_shift(
    work_items: &[WorkItemRecord],
    timelogs: &[TimelogRecord],
) -> Vec<CategorySprintShift> {
    let work_item_cat = resolve_work_item_categories(work_items);
    let mut sprint_cats: BTreeMap<i64, (i64, i64, i64, i64, i64, i64)> = BTreeMap::new();

    for t in timelogs {
        let s_num = t.sprint_number.unwrap_or(1);
        let cat = t
            .work_item_id
            .as_ref()
            .and_then(|wid| work_item_cat.get(wid))
            .cloned()
            .unwrap_or(CategoryId::Other);

        let entry = sprint_cats.entry(s_num).or_insert((0, 0, 0, 0, 0, 0));
        match cat {
            CategoryId::ProjectManagement => entry.0 += t.time_spent,
            CategoryId::RequirementsEngineering => entry.1 += t.time_spent,
            CategoryId::Implementation => entry.2 += t.time_spent,
            CategoryId::Architecture => entry.3 += t.time_spent,
            CategoryId::Other => entry.4 += t.time_spent,
        }
        entry.5 += t.time_spent;
    }

    sprint_cats
        .into_iter()
        .map(
            |(s_num, (pm, re, imp, arch, other, tot))| CategorySprintShift {
                sprint_number: s_num,
                pm_hours: (pm as f64 / 3600.0 * 10.0).round() / 10.0,
                re_hours: (re as f64 / 3600.0 * 10.0).round() / 10.0,
                impl_hours: (imp as f64 / 3600.0 * 10.0).round() / 10.0,
                arch_hours: (arch as f64 / 3600.0 * 10.0).round() / 10.0,
                other_hours: (other as f64 / 3600.0 * 10.0).round() / 10.0,
                total_hours: (tot as f64 / 3600.0 * 10.0).round() / 10.0,
            },
        )
        .collect()
}
