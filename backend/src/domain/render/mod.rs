use crate::{
    db::{groups::GroupRecord, users::UserRecord},
    domain::{
        analytics::metrics::{FairnessMetric, UserCategoryMatrixRow},
        gamification::evaluator::UserGamificationSummary,
    },
};

pub fn render_user_card_svg(user: &UserRecord, summary: &UserGamificationSummary) -> String {
    let name = html_escape(user.custom_display_name.as_deref().unwrap_or(&user.name));
    let username = html_escape(&user.username);
    let level = summary.level_progress.level;
    let tier_name = html_escape(&summary.level_progress.tier_name);
    let tier_color = &summary.level_progress.tier_color;
    let hours = summary.total_hours;
    let streak = summary.streak_days;
    let xp = summary.level_progress.current_xp;
    let next_xp = summary.level_progress.next_level_xp;
    let pct = (summary.level_progress.progress_pct * 100.0).clamp(0.0, 100.0);
    let bar_width = (pct / 100.0 * 368.0) as u32;

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="440" height="176" viewBox="0 0 440 176" fill="none">
  <rect x="0.5" y="0.5" width="439" height="175" rx="4" fill="#09090b" stroke="#27272a"/>
  
  <!-- Level Badge -->
  <rect x="24" y="24" width="38" height="38" rx="4" fill="#18181b" stroke="#27272a"/>
  <text x="43" y="48" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" text-anchor="middle" fill="{tier_color}">L{level}</text>

  <!-- User Info -->
  <text x="74" y="38" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#f4f4f5">{name}</text>
  <text x="74" y="55" font-family="monospace" font-size="12" fill="#71717a">@{username} <tspan font-family="system-ui, -apple-system, sans-serif" fill="#52525b">•</tspan> {tier_name} Tier</text>

  <!-- Divider -->
  <line x1="24" y1="78" x2="416" y2="78" stroke="#27272a" stroke-width="1"/>

  <!-- XP Progress -->
  <text x="24" y="98" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" fill="#a1a1aa">Level Progress</text>
  <text x="416" y="98" font-family="monospace" font-size="11" text-anchor="end" fill="#71717a">{xp} / {next_xp} XP</text>
  <rect x="24" y="105" width="392" height="4" rx="2" fill="#27272a"/>
  <rect x="24" y="105" width="{bar_width}" height="4" rx="2" fill="{tier_color}"/>

  <!-- Bottom Stats -->
  <text x="24" y="142" font-family="monospace" font-size="12" font-weight="600" fill="#f4f4f5">{hours}h</text>
  <text x="66" y="142" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#71717a">Logged</text>
  
  <text x="124" y="142" font-family="monospace" font-size="12" font-weight="600" fill="#f4f4f5">{streak}</text>
  <text x="142" y="142" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#71717a">Sprint Streak</text>

  <text x="416" y="142" font-family="monospace" font-size="12" font-weight="600" text-anchor="end" fill="#d4d4d8">{badge_count} <tspan font-family="system-ui, -apple-system, sans-serif" font-weight="400" fill="#71717a">Badges</tspan></text>
</svg>"##,
        badge_count = summary.unlocked_badges.len()
    )
}

pub fn render_group_banner_svg(
    group: &GroupRecord,
    total_hours: f64,
    fairness: &FairnessMetric,
) -> String {
    let name = html_escape(&group.name);
    let path = html_escape(&group.full_path);
    let rating = html_escape(&fairness.rating);
    let cv = fairness.coefficient_of_variation;

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="480" height="136" viewBox="0 0 480 136" fill="none">
  <rect x="0.5" y="0.5" width="479" height="135" rx="4" fill="#09090b" stroke="#27272a"/>
  
  <text x="24" y="34" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="#f4f4f5">{name}</text>
  <text x="24" y="52" font-family="monospace" font-size="11" fill="#71717a">{path}</text>
  
  <line x1="24" y1="68" x2="456" y2="68" stroke="#27272a" stroke-width="1"/>

  <text x="24" y="92" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#71717a">Total Effort</text>
  <text x="24" y="112" font-family="monospace" font-size="15" font-weight="600" fill="#f4f4f5">{total_hours}h</text>

  <text x="200" y="92" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#71717a">Fairness Balance</text>
  <text x="200" y="112" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#f4f4f5">{rating} <tspan font-family="monospace" font-size="12" font-weight="400" fill="#71717a">(CV {cv})</tspan></text>
</svg>"##
    )
}

pub fn render_sprint_matrix_svg(
    group: &GroupRecord,
    sprint_title: &str,
    rows: &[UserCategoryMatrixRow],
) -> String {
    let group_name = html_escape(&group.name);
    let title = html_escape(sprint_title);

    let row_count = rows.len();
    let has_rows = row_count > 0;
    let card_height = if has_rows {
        100 + (row_count as u32 * 32) + 38 + 16
    } else {
        180
    };

    let mut tot_pm = 0.0;
    let mut tot_re = 0.0;
    let mut tot_arch = 0.0;
    let mut tot_impl = 0.0;
    let mut tot_other = 0.0;
    let mut tot_all = 0.0;

    let mut rows_svg = String::new();

    for (i, r) in rows.iter().enumerate() {
        tot_pm += r.pm_hours;
        tot_re += r.re_hours;
        tot_arch += r.arch_hours;
        tot_impl += r.impl_hours;
        tot_other += r.other_hours;
        tot_all += r.total_hours;

        let row_y = 100 + (i as u32 * 32);
        let zebra = if i % 2 == 1 {
            format!(r##"<rect x="20" y="{row_y}" width="680" height="30" fill="#121214"/>"##)
        } else {
            String::new()
        };

        let disp_name = html_escape(r.custom_display_name.as_deref().unwrap_or(&r.name));
        let uname = html_escape(&r.username);

        fn fmt_val(v: f64) -> String {
            if v > 0.0 {
                format!(r#"{:.1}h"#, v)
            } else {
                "-".to_string()
            }
        }

        let pm_str = fmt_val(r.pm_hours);
        let re_str = fmt_val(r.re_hours);
        let arch_str = fmt_val(r.arch_hours);
        let impl_str = fmt_val(r.impl_hours);
        let other_str = fmt_val(r.other_hours);
        let tot_str = format!("{:.1}h", r.total_hours);

        let text_y = row_y + 20;
        rows_svg.push_str(&format!(
            r##"{zebra}
  <text x="28" y="{text_y}" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#f4f4f5">{disp_name} <tspan font-family="monospace" font-size="10" fill="#71717a">@{uname}</tspan></text>
  <text x="235" y="{text_y}" font-family="monospace" font-size="11" fill="#a1a1aa" text-anchor="end">{pm_str}</text>
  <text x="325" y="{text_y}" font-family="monospace" font-size="11" fill="#a1a1aa" text-anchor="end">{re_str}</text>
  <text x="425" y="{text_y}" font-family="monospace" font-size="11" fill="#a1a1aa" text-anchor="end">{arch_str}</text>
  <text x="535" y="{text_y}" font-family="monospace" font-size="11" fill="#a1a1aa" text-anchor="end">{impl_str}</text>
  <text x="615" y="{text_y}" font-family="monospace" font-size="11" fill="#a1a1aa" text-anchor="end">{other_str}</text>
  <text x="690" y="{text_y}" font-family="monospace" font-size="11" font-weight="600" fill="#f4f4f5" text-anchor="end">{tot_str}</text>
  <line x1="20" y1="{line_y}" x2="700" y2="{line_y}" stroke="#1f1f23" stroke-width="1"/>
"##,
            line_y = row_y + 31
        ));
    }

    let summary_svg = if has_rows {
        let total_y = 100 + (row_count as u32 * 32) + 2;
        let text_y = total_y + 20;
        format!(
            r##"<rect x="20" y="{total_y}" width="680" height="32" rx="2" fill="#18181b" stroke="#27272a" stroke-width="1"/>
  <text x="28" y="{text_y}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#f4f4f5">Total</text>
  <text x="235" y="{text_y}" font-family="monospace" font-size="11" font-weight="600" fill="#f4f4f5" text-anchor="end">{tot_pm:.1}h</text>
  <text x="325" y="{text_y}" font-family="monospace" font-size="11" font-weight="600" fill="#f4f4f5" text-anchor="end">{tot_re:.1}h</text>
  <text x="425" y="{text_y}" font-family="monospace" font-size="11" font-weight="600" fill="#f4f4f5" text-anchor="end">{tot_arch:.1}h</text>
  <text x="535" y="{text_y}" font-family="monospace" font-size="11" font-weight="600" fill="#f4f4f5" text-anchor="end">{tot_impl:.1}h</text>
  <text x="615" y="{text_y}" font-family="monospace" font-size="11" font-weight="600" fill="#f4f4f5" text-anchor="end">{tot_other:.1}h</text>
  <text x="690" y="{text_y}" font-family="monospace" font-size="11" font-weight="700" fill="#38bdf8" text-anchor="end">{tot_all:.1}h</text>"##
        )
    } else {
        r##"<text x="360" y="130" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#71717a" text-anchor="middle">No timelogs recorded for this sprint.</text>"##.to_string()
    };

    let total_badge = format!("{tot_all:.1}h Total");

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="720" height="{card_height}" viewBox="0 0 720 {card_height}" fill="none">
  <rect x="0.5" y="0.5" width="719" height="{card_height_inner}" rx="4" fill="#09090b" stroke="#27272a"/>

  <!-- Card Header -->
  <text x="24" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#f4f4f5">{group_name}</text>
  <text x="24" y="48" font-family="monospace" font-size="11" fill="#71717a">Sprint Time Matrix • {title}</text>
  
  <rect x="612" y="18" width="84" height="22" rx="2" fill="#18181b" stroke="#27272a"/>
  <text x="654" y="33" font-family="monospace" font-size="11" font-weight="600" text-anchor="middle" fill="#38bdf8">{total_badge}</text>

  <!-- Table Header -->
  <rect x="20" y="66" width="680" height="26" rx="2" fill="#18181b"/>
  <text x="28" y="83" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#71717a">ENGINEER</text>
  <text x="235" y="83" font-family="monospace" font-size="10" font-weight="600" fill="#71717a" text-anchor="end">PM</text>
  <text x="325" y="83" font-family="monospace" font-size="10" font-weight="600" fill="#71717a" text-anchor="end">REQ ENG</text>
  <text x="425" y="83" font-family="monospace" font-size="10" font-weight="600" fill="#71717a" text-anchor="end">ARCH</text>
  <text x="535" y="83" font-family="monospace" font-size="10" font-weight="600" fill="#71717a" text-anchor="end">IMPL</text>
  <text x="615" y="83" font-family="monospace" font-size="10" font-weight="600" fill="#71717a" text-anchor="end">OTHER</text>
  <text x="690" y="83" font-family="monospace" font-size="10" font-weight="600" fill="#71717a" text-anchor="end">TOTAL</text>

  <!-- Data Rows -->
  {rows_svg}
  <!-- Totals Summary -->
  {summary_svg}
</svg>"##,
        card_height_inner = card_height - 1
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
