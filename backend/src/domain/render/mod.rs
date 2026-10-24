use crate::{
    db::{groups::GroupRecord, users::UserRecord},
    domain::{
        analytics::metrics::FairnessMetric,
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
  <text x="140" y="162" font-family="system-ui, sans-serif" font-size="12" fill="#71717a">• {streak} Active Days</text>
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

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
