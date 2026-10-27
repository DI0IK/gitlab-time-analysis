use crate::{
    db::{groups::GroupRecord, users::UserRecord},
    domain::{
        analytics::metrics::{FairnessMetric, UserCategoryMatrixRow},
        gamification::{catalog::BadgeMeta, evaluator::UserGamificationSummary},
    },
};

pub fn render_badge_svg(badge: &BadgeMeta) -> String {
    let title = html_escape(&badge.title);
    let track = html_escape(&badge.track);
    let desc = html_escape(&badge.description);
    let xp = badge.reward_xp;

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="340" height="96" viewBox="0 0 340 96" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="340" y2="96" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="border" x1="0" y1="0" x2="340" y2="96" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0.4"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="338" height="94" rx="14" fill="url(#bg)" stroke="url(#border)" stroke-width="1.5"/>
  <circle cx="48" cy="48" r="24" fill="#27272a"/>
  <text x="48" y="55" font-family="system-ui, sans-serif" font-size="20" text-anchor="middle" fill="#f59e0b">★</text>
  <text x="86" y="32" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#a1a1aa" letter-spacing="0.05em">{track}</text>
  <text x="86" y="50" font-family="system-ui, sans-serif" font-size="15" font-weight="700" fill="#fafafa">{title}</text>
  <text x="86" y="68" font-family="system-ui, sans-serif" font-size="11" fill="#71717a">{desc}</text>
  <rect x="264" y="22" width="60" height="22" rx="11" fill="#f59e0b" fill-opacity="0.15"/>
  <text x="294" y="37" font-family="system-ui, sans-serif" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">+{xp} XP</text>
</svg>"##
    )
}

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
    let bar_width = (pct / 100.0 * 240.0) as u32;

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="440" height="190" viewBox="0 0 440 190" fill="none">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="440" y2="190" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#13151b"/>
      <stop offset="100%" stop-color="#0b0d13"/>
    </linearGradient>
  </defs>
  <rect width="440" height="190" rx="16" fill="url(#cardBg)" stroke="#27272a" stroke-width="1.5"/>
  <circle cx="52" cy="52" r="26" fill="{tier_color}" fill-opacity="0.2"/>
  <circle cx="52" cy="52" r="26" stroke="{tier_color}" stroke-width="2"/>
  <text x="52" y="60" font-family="system-ui, sans-serif" font-size="20" font-weight="800" text-anchor="middle" fill="{tier_color}">L{level}</text>
  <text x="94" y="44" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="#fafafa">{name}</text>
  <text x="94" y="62" font-family="system-ui, sans-serif" font-size="12" fill="#71717a">@{username} • {tier_name} Tier</text>
  <rect x="36" y="96" width="368" height="1" fill="#27272a"/>
  <text x="36" y="122" font-family="system-ui, sans-serif" font-size="11" fill="#a1a1aa">Level Progress</text>
  <text x="404" y="122" font-family="system-ui, sans-serif" font-size="11" text-anchor="end" fill="#71717a">{xp} / {next_xp} XP</text>
  <rect x="36" y="130" width="368" height="6" rx="3" fill="#27272a"/>
  <rect x="36" y="130" width="{bar_width}" height="6" rx="3" fill="{tier_color}"/>
  <text x="36" y="162" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#fafafa">{hours}h Logged</text>
  <text x="140" y="162" font-family="system-ui, sans-serif" font-size="12" fill="#71717a">• {streak} Sprint Streak</text>
  <text x="404" y="162" font-family="system-ui, sans-serif" font-size="11" font-weight="600" text-anchor="end" fill="#f59e0b">{badge_count} Badges Unlocked</text>
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
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="500" height="150" viewBox="0 0 500 150" fill="none">
  <rect width="500" height="150" rx="16" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>
  <text x="32" y="44" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="#f8fafc">{name}</text>
  <text x="32" y="66" font-family="monospace" font-size="12" fill="#94a3b8">{path}</text>
  <rect x="32" y="86" width="436" height="1" fill="#1e293b"/>
  <text x="32" y="118" font-family="system-ui, sans-serif" font-size="12" fill="#94a3b8">Total Effort</text>
  <text x="32" y="136" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="#38bdf8">{total_hours}h</text>
  <text x="200" y="118" font-family="system-ui, sans-serif" font-size="12" fill="#94a3b8">Workload Balance</text>
  <text x="200" y="136" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="#4ade80">{rating} (CV {cv})</text>
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
        120 + (row_count as u32 * 36) + 42 + 20
    } else {
        200
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

        let row_y = 120 + (i as u32 * 36);
        let zebra = if i % 2 == 1 {
            format!(
                r##"<rect x="24" y="{row_y}" width="672" height="34" rx="4" fill="#1e293b" fill-opacity="0.25"/>"##
            )
        } else {
            String::new()
        };

        let disp_name = html_escape(r.custom_display_name.as_deref().unwrap_or(&r.name));
        let uname = html_escape(&r.username);

        fn fmt_val(v: f64, col: &str) -> String {
            if v > 0.0 {
                format!(r#"<tspan fill="{col}">{:.1}h</tspan>"#, v)
            } else {
                r##"<tspan fill="#475569">-</tspan>"##.to_string()
            }
        }

        let pm_str = fmt_val(r.pm_hours, "#e9d5ff");
        let re_str = fmt_val(r.re_hours, "#bfdbfe");
        let arch_str = fmt_val(r.arch_hours, "#fde68a");
        let impl_str = fmt_val(r.impl_hours, "#a7f3d0");
        let other_str = fmt_val(r.other_hours, "#cbd5e1");
        let tot_str = format!("{:.1}h", r.total_hours);

        let text_y = row_y + 22;
        rows_svg.push_str(&format!(
            r##"{zebra}
  <text x="36" y="{text_y}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#f1f5f9">{disp_name} <tspan font-family="monospace" font-size="10" font-weight="400" fill="#64748b">@{uname}</tspan></text>
  <text x="235" y="{text_y}" font-family="monospace" font-size="11" text-anchor="end">{pm_str}</text>
  <text x="325" y="{text_y}" font-family="monospace" font-size="11" text-anchor="end">{re_str}</text>
  <text x="425" y="{text_y}" font-family="monospace" font-size="11" text-anchor="end">{arch_str}</text>
  <text x="535" y="{text_y}" font-family="monospace" font-size="11" text-anchor="end">{impl_str}</text>
  <text x="615" y="{text_y}" font-family="monospace" font-size="11" text-anchor="end">{other_str}</text>
  <text x="684" y="{text_y}" font-family="monospace" font-size="12" font-weight="700" fill="#38bdf8" text-anchor="end">{tot_str}</text>
  <line x1="24" y1="{line_y}" x2="696" y2="{line_y}" stroke="#1e293b" stroke-opacity="0.4" stroke-width="1"/>
"##,
            line_y = row_y + 35
        ));
    }

    let summary_svg = if has_rows {
        let total_y = 120 + (row_count as u32 * 36) + 4;
        let text_y = total_y + 23;
        format!(
            r##"<rect x="24" y="{total_y}" width="672" height="36" rx="6" fill="#1e293b" fill-opacity="0.7" stroke="#334155" stroke-width="1"/>
  <text x="36" y="{text_y}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#f8fafc">Total</text>
  <text x="235" y="{text_y}" font-family="monospace" font-size="11" font-weight="700" fill="#c084fc" text-anchor="end">{tot_pm:.1}h</text>
  <text x="325" y="{text_y}" font-family="monospace" font-size="11" font-weight="700" fill="#60a5fa" text-anchor="end">{tot_re:.1}h</text>
  <text x="425" y="{text_y}" font-family="monospace" font-size="11" font-weight="700" fill="#fbbf24" text-anchor="end">{tot_arch:.1}h</text>
  <text x="535" y="{text_y}" font-family="monospace" font-size="11" font-weight="700" fill="#34d399" text-anchor="end">{tot_impl:.1}h</text>
  <text x="615" y="{text_y}" font-family="monospace" font-size="11" font-weight="700" fill="#94a3b8" text-anchor="end">{tot_other:.1}h</text>
  <text x="684" y="{text_y}" font-family="monospace" font-size="12" font-weight="800" fill="#38bdf8" text-anchor="end">{tot_all:.1}h</text>"##
        )
    } else {
        r##"<text x="360" y="145" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#64748b" text-anchor="middle">No timelogs recorded for this sprint.</text>"##.to_string()
    };

    let total_badge = format!("{tot_all:.1}h Total");

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="720" height="{card_height}" viewBox="0 0 720 {card_height}" fill="none">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="720" y2="{card_height}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#0b0f19"/>
    </linearGradient>
  </defs>
  <rect width="720" height="{card_height}" rx="14" fill="url(#cardBg)" stroke="#334155" stroke-width="1.5"/>

  <!-- Card Header -->
  <text x="32" y="38" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#f8fafc">{group_name}</text>
  <text x="32" y="58" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#94a3b8">Sprint Time Matrix • {title}</text>
  <rect x="588" y="25" width="108" height="26" rx="13" fill="#0284c7" fill-opacity="0.15" stroke="#38bdf8" stroke-opacity="0.3"/>
  <text x="642" y="42" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">{total_badge}</text>

  <!-- Table Header -->
  <rect x="24" y="80" width="672" height="28" rx="6" fill="#1e293b" fill-opacity="0.6"/>
  <text x="36" y="98" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#94a3b8">ENGINEER</text>
  <text x="235" y="98" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#c084fc" text-anchor="end">PM</text>
  <text x="325" y="98" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#60a5fa" text-anchor="end">REQ ENG</text>
  <text x="425" y="98" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#fbbf24" text-anchor="end">ARCH</text>
  <text x="535" y="98" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#34d399" text-anchor="end">IMPL</text>
  <text x="615" y="98" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#94a3b8" text-anchor="end">OTHER</text>
  <text x="684" y="98" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#f8fafc" text-anchor="end">TOTAL</text>

  <!-- Data Rows -->
  {rows_svg}
  <!-- Totals Summary -->
  {summary_svg}
</svg>"##
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
