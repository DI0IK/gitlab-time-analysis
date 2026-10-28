use std::collections::{BTreeSet, HashMap};

use crate::{
    db::{timelogs::TimelogRecord, work_items::WorkItemRecord},
    domain::{
        analytics::{
            distribution::categories::resolve_work_item_categories,
            metrics::{MemberMetric, MemberRoleSpecialization, UserCategoryMatrixRow},
        },
        categories::CategoryId,
    },
};

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

pub fn compute_role_specializations(
    matrix: &[UserCategoryMatrixRow],
) -> Vec<MemberRoleSpecialization> {
    let mut specs = Vec::new();

    for row in matrix.iter().filter(|r| r.sprint_number.is_none()) {
        if row.total_hours <= 0.0 {
            continue;
        }

        let tot = row.total_hours;
        let pm_pct = ((row.pm_hours / tot) * 100.0).round();
        let re_pct = ((row.re_hours / tot) * 100.0).round();
        let impl_pct = ((row.impl_hours / tot) * 100.0).round();
        let arch_pct = ((row.arch_hours / tot) * 100.0).round();
        let other_pct = ((row.other_hours / tot) * 100.0).round();

        let mut max_cat = "Generalist";
        let mut max_pct = 0.0;
        for (cat, pct) in [
            ("Implementation Specialist", impl_pct),
            ("Requirements Analyst", re_pct),
            ("Software Architect", arch_pct),
            ("Project Manager", pm_pct),
            ("General Contributor", other_pct),
        ] {
            if pct > max_pct {
                max_pct = pct;
                max_cat = cat;
            }
        }

        specs.push(MemberRoleSpecialization {
            username: row.username.clone(),
            name: row.name.clone(),
            avatar_url: row.avatar_url.clone(),
            pm_percentage: pm_pct,
            re_percentage: re_pct,
            impl_percentage: impl_pct,
            arch_percentage: arch_pct,
            other_percentage: other_pct,
            primary_role: max_cat.to_string(),
            total_hours: row.total_hours,
        });
    }

    specs.sort_by(|a, b| {
        b.total_hours
            .partial_cmp(&a.total_hours)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    specs
}
