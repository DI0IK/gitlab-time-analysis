use std::collections::HashMap;

use chrono::{Datelike, Timelike};

use crate::{
    db::timelogs::TimelogRecord,
    domain::analytics::metrics::{
        TimeBlockSummary, TimeOfDayCell, TimeOfDayHeatmap, WeekdayHeatmapCell, WeekdaySprintHeatmap,
    },
};

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

pub fn compute_time_of_day_heatmap(timelogs: &[TimelogRecord]) -> TimeOfDayHeatmap {
    let weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let mut day_hour_map: HashMap<(u32, u32), (i64, usize)> = HashMap::new();
    let mut hourly_seconds: [i64; 24] = [0; 24];
    let mut total_seconds: i64 = 0;

    for t in timelogs {
        let weekday = t.spent_at.weekday().number_from_monday(); // 1 = Mon, 7 = Sun
        let hour = t.spent_at.hour(); // 0..=23
        let entry = day_hour_map.entry((weekday, hour)).or_insert((0, 0));
        entry.0 += t.time_spent;
        entry.1 += 1;
        if (hour as usize) < 24 {
            hourly_seconds[hour as usize] += t.time_spent;
        }
        total_seconds += t.time_spent;
    }

    let mut cells = Vec::with_capacity(7 * 24);
    let mut max_hours = 0.0f64;

    for weekday in 1..=7 {
        for hour in 0..24 {
            let (secs, count) = day_hour_map
                .get(&(weekday, hour))
                .copied()
                .unwrap_or((0, 0));
            let hours = (secs as f64 / 3600.0 * 10.0).round() / 10.0;
            if hours > max_hours {
                max_hours = hours;
            }
            cells.push(TimeOfDayCell {
                weekday,
                weekday_name: weekday_names[(weekday - 1) as usize].to_string(),
                hour,
                total_seconds: secs,
                total_hours: hours,
                timelog_count: count,
            });
        }
    }

    let hourly_totals: Vec<f64> = hourly_seconds
        .iter()
        .map(|&s| (s as f64 / 3600.0 * 10.0).round() / 10.0)
        .collect();

    let mut peak_hour = 14u32;
    let mut peak_hour_hours = 0.0f64;
    for (h, &hrs) in hourly_totals.iter().enumerate() {
        if hrs > peak_hour_hours {
            peak_hour_hours = hrs;
            peak_hour = h as u32;
        }
    }

    let total_hours = (total_seconds as f64 / 3600.0 * 10.0).round() / 10.0;

    let morning_secs: i64 = hourly_seconds[6..12].iter().sum();
    let afternoon_secs: i64 = hourly_seconds[12..18].iter().sum();
    let evening_secs: i64 = hourly_seconds[18..22].iter().sum();
    let night_secs: i64 =
        hourly_seconds[22..24].iter().sum::<i64>() + hourly_seconds[0..6].iter().sum::<i64>();

    let to_block = |name: &str, secs: i64| {
        let hrs = (secs as f64 / 3600.0 * 10.0).round() / 10.0;
        let pct = if total_seconds > 0 {
            ((secs as f64 / total_seconds as f64) * 100.0).round()
        } else {
            0.0
        };
        TimeBlockSummary {
            name: name.to_string(),
            hours: hrs,
            percentage: pct,
        }
    };

    let time_blocks = vec![
        to_block("Morning (06:00-12:00)", morning_secs),
        to_block("Afternoon (12:00-18:00)", afternoon_secs),
        to_block("Evening (18:00-22:00)", evening_secs),
        to_block("Night (22:00-06:00)", night_secs),
    ];

    let core_hours_secs: i64 = hourly_seconds[9..18].iter().sum();
    let core_hours_pct = if total_seconds > 0 {
        ((core_hours_secs as f64 / total_seconds as f64) * 100.0).round()
    } else {
        0.0
    };

    let night_owl_pct = if total_seconds > 0 {
        ((night_secs as f64 / total_seconds as f64) * 100.0).round()
    } else {
        0.0
    };

    TimeOfDayHeatmap {
        cells,
        max_hours,
        total_hours,
        peak_hour,
        peak_hour_hours,
        core_hours_pct,
        night_owl_pct,
        time_blocks,
        hourly_totals,
    }
}
