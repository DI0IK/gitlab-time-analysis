import {
  matchLabelToCategory,
  CATEGORY_DEFINITIONS,
} from "../config/categories";
import { GroupTimelogsResponse } from "../api/group/[id]/timelogs/route";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TierName = "bronze" | "silver" | "gold" | "legend";
export type BadgeTrack =
  | "endurance"
  | "velocity"
  | "shipping"
  | "quality"
  | "momentum"
  | "automation"
  | "one-time";

export type GamificationMergeRequest = {
  id: string;
  title: string;
  state: string;
  webUrl: string;
  createdAt: string;
  mergedAt: string | null;
  username: string; // author username
  approvedBy: string[]; // array of usernames who approved
  discussionAuthors: string[]; // array of usernames who commented
  discussionCount: number;
};

export type BadgeInfo = {
  id: string;
  name: string;
  icon: string;
  description: string;
  track: BadgeTrack;
  unlocked: boolean;
  progressText: string;
  xpReward: number;
};

export type GamificationStats = {
  xp: number;
  level: number;
  tierName: TierName;
  tierLabel: string;
  tierColor: string;
  xpToNextLevel: number;
  xpPercent: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  longestStreak: number;
  xpBreakdown: {
    hoursXp: number;
    issuesXp: number;
    blindFlightPenalty: number;
    sprintsXp: number;
    reviewsXp: number;
    badgesXp: number;
  };
  badges: BadgeInfo[];
};

// ---------------------------------------------------------------------------
// Tier system — piecewise linear XP per level
// ---------------------------------------------------------------------------

const TIER_CONFIG = [
  {
    minLevel: 1,
    maxLevel: 9,
    xpPerLevel: 250,
    name: "bronze" as TierName,
    label: "Bronze",
    color: "#cd7f32",
  },
  {
    minLevel: 10,
    maxLevel: 19,
    xpPerLevel: 350,
    name: "silver" as TierName,
    label: "Silver",
    color: "#c0c0c0",
  },
  {
    minLevel: 20,
    maxLevel: 29,
    xpPerLevel: 450,
    name: "gold" as TierName,
    label: "Gold",
    color: "#ffd700",
  },
  {
    minLevel: 30,
    maxLevel: Infinity,
    xpPerLevel: 550,
    name: "legend" as TierName,
    label: "Legend",
    color: "#a855f7",
  },
];

function xpNeededForLevel(level: number): number {
  if (level <= 1) return 0;
  let xp = 0;
  for (let l = 1; l < level; l++) {
    const tier =
      TIER_CONFIG.find((t) => l >= t.minLevel && l <= t.maxLevel) ??
      TIER_CONFIG[TIER_CONFIG.length - 1];
    xp += tier.xpPerLevel;
  }
  return xp;
}

function getTier(level: number): (typeof TIER_CONFIG)[number] {
  return (
    TIER_CONFIG.find((t) => level >= t.minLevel && level <= t.maxLevel) ??
    TIER_CONFIG[TIER_CONFIG.length - 1]
  );
}

function computeLevelInfo(xp: number): {
  level: number;
  tierName: TierName;
  tierLabel: string;
  tierColor: string;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  xpToNextLevel: number;
  xpPercent: number;
} {
  let level = 1;
  while (true) {
    const nextXp = xpNeededForLevel(level + 1);
    if (nextXp > xp) break;
    level++;
  }

  const xpForCurrent = xpNeededForLevel(level);
  const xpForNext = xpNeededForLevel(level + 1);
  const xpToNext = xpForNext - xp;
  const xpInLevel = xp - xpForCurrent;
  const xpRange = xpForNext - xpForCurrent;
  const xpPercent =
    xpRange > 0 ? Math.min(100, (xpInLevel / xpRange) * 100) : 100;
  const tier = getTier(level);

  return {
    level,
    tierName: tier.name,
    tierLabel: tier.label,
    tierColor: tier.color,
    xpForCurrentLevel: xpForCurrent,
    xpForNextLevel: xpForNext,
    xpToNextLevel: xpToNext,
    xpPercent: Math.round(xpPercent * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the longest consecutive run in a sorted array of sprint numbers. */
function longestConsecutiveRun(sortedSprints: number[]): number {
  if (sortedSprints.length === 0) return 0;
  let max = 1;
  let current = 1;
  for (let i = 1; i < sortedSprints.length; i++) {
    if (sortedSprints[i] === sortedSprints[i - 1] + 1) {
      current++;
      if (current > max) max = current;
    } else {
      current = 1;
    }
  }
  return max;
}

// ---------------------------------------------------------------------------
// Badge definitions
// ---------------------------------------------------------------------------

type RawBadgeDef = {
  id: string;
  name: string;
  icon: string;
  description: string;
  track: BadgeTrack;
  xpReward: number;
  // threshold is interpreted per-track:
  //   endurance  → totalHours
  //   velocity   → closedEstimatedHours
  //   shipping   → mergedMrsCount
  //   quality    → reviewedMrsCount
  //   momentum   → activeSprintCount
  threshold: number;
};

const ENDURANCE_BADGES: RawBadgeDef[] = [
  {
    id: "endurance_1",
    name: "Greenhorn",
    icon: "🥉",
    description: "Log 1+ hour total",
    track: "endurance",
    xpReward: 15,
    threshold: 1,
  },
  {
    id: "endurance_2",
    name: "Apprentice",
    icon: "🥉",
    description: "Log 10+ hours total",
    track: "endurance",
    xpReward: 50,
    threshold: 10,
  },
  {
    id: "endurance_3",
    name: "Dedicated Worker",
    icon: "🥈",
    description: "Log 30+ hours total",
    track: "endurance",
    xpReward: 100,
    threshold: 30,
  },
  {
    id: "endurance_4",
    name: "Deep Worker",
    icon: "🥈",
    description: "Log 60+ hours total",
    track: "endurance",
    xpReward: 150,
    threshold: 60,
  },
  {
    id: "endurance_5",
    name: "Century Club",
    icon: "🥇",
    description: "Log 100+ hours total",
    track: "endurance",
    xpReward: 200,
    threshold: 100,
  },
  {
    id: "endurance_6",
    name: "Marathoner",
    icon: "👑",
    description: "Log 130+ hours total",
    track: "endurance",
    xpReward: 250,
    threshold: 130,
  },
  {
    id: "endurance_7",
    name: "Apex Contributor",
    icon: "🌌",
    description: "Log 150+ hours total",
    track: "endurance",
    xpReward: 400,
    threshold: 150,
  },
];

const VELOCITY_BADGES: RawBadgeDef[] = [
  {
    id: "velocity_1",
    name: "Task Solver",
    icon: "🥉",
    description: "Close issues totaling 5+ estimated hours",
    track: "velocity",
    xpReward: 20,
    threshold: 5,
  },
  {
    id: "velocity_2",
    name: "Problem Solver",
    icon: "🥈",
    description: "Close issues totaling 20+ estimated hours",
    track: "velocity",
    xpReward: 50,
    threshold: 20,
  },
  {
    id: "velocity_3",
    name: "Code Crusader",
    icon: "🥈",
    description: "Close issues totaling 45+ estimated hours",
    track: "velocity",
    xpReward: 100,
    threshold: 45,
  },
  {
    id: "velocity_4",
    name: "Issue Sweeper",
    icon: "🥇",
    description: "Close issues totaling 70+ estimated hours",
    track: "velocity",
    xpReward: 150,
    threshold: 70,
  },
  {
    id: "velocity_5",
    name: "Task Master",
    icon: "🏆",
    description: "Close issues totaling 100+ estimated hours",
    track: "velocity",
    xpReward: 250,
    threshold: 100,
  },
  {
    id: "velocity_6",
    name: "Titan of Tasks",
    icon: "🪐",
    description: "Close issues totaling 150+ estimated hours",
    track: "velocity",
    xpReward: 350,
    threshold: 150,
  },
];

const SHIPPING_BADGES: RawBadgeDef[] = [
  {
    id: "shipping_1",
    name: "Continuous Integrator",
    icon: "🥉",
    description: "Have 5 of your MRs merged",
    track: "shipping",
    xpReward: 50,
    threshold: 5,
  },
  {
    id: "shipping_2",
    name: "Git Master",
    icon: "🥈",
    description: "Have 10 of your MRs merged",
    track: "shipping",
    xpReward: 100,
    threshold: 10,
  },
  {
    id: "shipping_3",
    name: "Merge Maestro",
    icon: "🥇",
    description: "Have 20 of your MRs merged",
    track: "shipping",
    xpReward: 150,
    threshold: 20,
  },
  {
    id: "shipping_4",
    name: "Deployment Deity",
    icon: "☄️",
    description: "Have 30+ of your MRs merged",
    track: "shipping",
    xpReward: 250,
    threshold: 30,
  },
];

const QUALITY_BADGES: RawBadgeDef[] = [
  {
    id: "quality_1",
    name: "Eagle Eye",
    icon: "🥉",
    description: "Approve/Review 5 teammate MRs",
    track: "quality",
    xpReward: 40,
    threshold: 5,
  },
  {
    id: "quality_2",
    name: "Code Guardian",
    icon: "🥈",
    description: "Approve/Review 12 teammate MRs",
    track: "quality",
    xpReward: 80,
    threshold: 12,
  },
  {
    id: "quality_3",
    name: "Sentinel",
    icon: "🥇",
    description: "Approve/Review 20 teammate MRs",
    track: "quality",
    xpReward: 150,
    threshold: 20,
  },
  {
    id: "quality_4",
    name: "The Gatekeeper",
    icon: "🦅",
    description: "Approve/Review 30+ teammate MRs",
    track: "quality",
    xpReward: 250,
    threshold: 30,
  },
];

const MOMENTUM_BADGES: RawBadgeDef[] = [
  {
    id: "momentum_1",
    name: "Sprint Jogger",
    icon: "🥉",
    description: "Active in 2 Iterations/Milestones",
    track: "momentum",
    xpReward: 20,
    threshold: 2,
  },
  {
    id: "momentum_2",
    name: "Sprint Machine",
    icon: "🥈",
    description: "Active in 6 Iterations/Milestones",
    track: "momentum",
    xpReward: 80,
    threshold: 6,
  },
  {
    id: "momentum_3",
    name: "Sprint Overlord",
    icon: "🥇",
    description: "Active in 10 Iterations/Milestones",
    track: "momentum",
    xpReward: 150,
    threshold: 10,
  },
  {
    id: "momentum_4",
    name: "Chronos",
    icon: "⏳",
    description: "Active in 15+ Iterations/Milestones",
    track: "momentum",
    xpReward: 300,
    threshold: 15,
  },
];

const AUTOMATION_BADGES: RawBadgeDef[] = [
  {
    id: "automation_1",
    name: "Ghost Writer",
    icon: "✍️",
    description: "Bot updates 50 MR descriptions or comments",
    track: "automation",
    xpReward: 100,
    threshold: 50,
  },
  {
    id: "automation_2",
    name: "Skynet",
    icon: "🧠",
    description: "Bot reaches 200 total automated actions",
    track: "automation",
    xpReward: 300,
    threshold: 200,
  },
];

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export function computeGamification(
  username: string,
  timelogs: GroupTimelogsResponse,
  mergeRequests: GamificationMergeRequest[] = [],
  isBot: boolean = false,
): GamificationStats {
  const lowerUser = username.toLowerCase();
  const userLogs = timelogs.filter(
    (log) => log.username.toLowerCase() === lowerUser,
  );

  // --------------- Total hours ---------------
  const totalHours =
    userLogs.reduce((sum, log) => sum + log.timeSpent, 0) / 3600;

  // --------------- Sprint / iteration data ---------------
  const sprintHoursMap: Record<number, number> = {};
  userLogs.forEach((log) => {
    if (log.sprintNumber !== undefined && log.sprintNumber !== null) {
      sprintHoursMap[log.sprintNumber] =
        (sprintHoursMap[log.sprintNumber] || 0) + log.timeSpent / 3600;
    }
  });

  const activeSprintNumbers = Object.keys(sprintHoursMap)
    .map(Number)
    .sort((a, b) => a - b);
  const longestStreak = longestConsecutiveRun(activeSprintNumbers);

  // --------------- Categories ---------------
  const categoryHours: Record<string, number> = { other: 0 };
  CATEGORY_DEFINITIONS.forEach((cat) => {
    categoryHours[cat.id] = 0;
  });
  userLogs.forEach((log) => {
    let assigned = "other";
    for (const label of log.issueLabels || []) {
      const cat = matchLabelToCategory(label);
      if (cat) {
        assigned = cat.id;
        break;
      }
    }
    categoryHours[assigned] += log.timeSpent / 3600;
  });

  let maxCategoryHours = 0;
  let maxCategoryName = "None";
  Object.entries(categoryHours).forEach(([id, hours]) => {
    if (hours > maxCategoryHours) {
      maxCategoryHours = hours;
      maxCategoryName =
        id === "other"
          ? "Other"
          : CATEGORY_DEFINITIONS.find((c) => c.id === id)?.label || "Other";
    }
  });
  const maxCategoryPercentage =
    totalHours > 0 ? (maxCategoryHours / totalHours) * 100 : 0;

  // --------------- Issue-level analysis ---------------
  const uniqueIssueUrls = new Set<string>();
  userLogs.forEach((log) => {
    if (log.issueUrl) uniqueIssueUrls.add(log.issueUrl);
  });

  // Closed issues the user contributed to (for Velocity track + issuesXp + one-time badges)
  const userClosedIssueUrls = new Set<string>();
  const closedIssueEstimates: Record<string, number> = {}; // issueUrl -> estimate in seconds

  userLogs.forEach((log) => {
    if (log.issueUrl && log.issueState === "closed") {
      userClosedIssueUrls.add(log.issueUrl);
      closedIssueEstimates[log.issueUrl] = log.issueTimeEstimate || 0;
    }
  });

  const totalClosedEstimateSeconds = Array.from(userClosedIssueUrls).reduce(
    (sum, url) => sum + closedIssueEstimates[url],
    0,
  );
  const totalClosedEstimateHours = totalClosedEstimateSeconds / 3600;

  // One-time badge counters
  let sharpShooterUnlocked = false;
  let heavyLifterUnlocked = false;

  Array.from(userClosedIssueUrls).forEach((issueUrl) => {
    const estimate = closedIssueEstimates[issueUrl];

    // Sharp Shooter: total time spent across all users is within ±10% of estimate
    if (estimate > 0) {
      const totalIssueSeconds = timelogs
        .filter((l) => l.issueUrl === issueUrl)
        .reduce((sum, l) => sum + l.timeSpent, 0);
      const diffPct = Math.abs(totalIssueSeconds - estimate) / estimate;
      if (diffPct <= 0.1) sharpShooterUnlocked = true;
    }

    // Heavy Lifter: estimate >= 8 hours
    if (estimate >= 8 * 3600) heavyLifterUnlocked = true;
  });

  // --------------- MR-level analysis ---------------
  const userMergedMrs = mergeRequests.filter(
    (mr) => mr.username.toLowerCase() === lowerUser && mr.state === "merged",
  );
  const mergedMrsCount = userMergedMrs.length;

  const reviewedMrs = mergeRequests.filter(
    (mr) =>
      mr.username.toLowerCase() !== lowerUser &&
      (mr.approvedBy.some((u) => u.toLowerCase() === lowerUser) ||
        mr.discussionAuthors.some((u) => u.toLowerCase() === lowerUser)),
  );
  const reviewedMrsCount = reviewedMrs.length;

  // (No synergy badge — removed per user request; the spec's 48h window
  // required review timestamps that are not available in the current data.)

  // --------------- Base XP ---------------
  // 20 XP per hour (fractional)
  const hoursXp = Math.floor(totalHours * 20);

  // 15 XP per estimated hour for closed issues, split proportionally by each user's
  // logged time on the issue; -10 Blind Flight penalty if no estimate, also split
  let issuesXp = 0;
  let blindFlightPenalty = 0;
  Array.from(userClosedIssueUrls).forEach((issueUrl) => {
    const estimate = closedIssueEstimates[issueUrl];
    const issueLogs = timelogs.filter((l) => l.issueUrl === issueUrl);
    const userSeconds = issueLogs
      .filter((l) => l.username.toLowerCase() === lowerUser)
      .reduce((sum, l) => sum + l.timeSpent, 0);
    const totalSeconds = issueLogs.reduce((sum, l) => sum + l.timeSpent, 0);
    if (totalSeconds <= 0) return;

    const share = userSeconds / totalSeconds;
    if (estimate > 0) {
      const totalIssueXp = Math.floor((estimate / 3600) * 15);
      issuesXp += Math.floor(share * totalIssueXp);
    } else {
      blindFlightPenalty += Math.floor(share * 10);
    }
  });

  // 50 XP per active sprint
  const sprintsXp = activeSprintNumbers.length * 50;

  // 15 XP per teammate MR reviewed
  const reviewsXp = reviewedMrsCount * 15;

  const baseXp =
    hoursXp + issuesXp + sprintsXp + reviewsXp - blindFlightPenalty;

  // --------------- Badge evaluation ---------------
  const badges: BadgeInfo[] = [];

  // Endurance
  ENDURANCE_BADGES.forEach((def) => {
    badges.push({
      ...def,
      unlocked: totalHours >= def.threshold,
      progressText: `${totalHours.toFixed(1)} / ${def.threshold} h`,
    });
  });

  // Velocity
  VELOCITY_BADGES.forEach((def) => {
    badges.push({
      ...def,
      unlocked: totalClosedEstimateHours >= def.threshold,
      progressText: `${totalClosedEstimateHours.toFixed(1)} / ${def.threshold} estimated hours`,
    });
  });

  // Shipping
  SHIPPING_BADGES.forEach((def) => {
    badges.push({
      ...def,
      unlocked: mergedMrsCount >= def.threshold,
      progressText: `${mergedMrsCount} / ${def.threshold} MRs`,
    });
  });

  // Quality
  QUALITY_BADGES.forEach((def) => {
    badges.push({
      ...def,
      unlocked: reviewedMrsCount >= def.threshold,
      progressText: `${reviewedMrsCount} / ${def.threshold} reviews`,
    });
  });

  // Momentum
  MOMENTUM_BADGES.forEach((def) => {
    badges.push({
      ...def,
      unlocked: activeSprintNumbers.length >= def.threshold,
      progressText: `${activeSprintNumbers.length} / ${def.threshold} iterations`,
    });
  });

  // Automation (only meaningful for bot accounts)
  const botActionsCount = mergeRequests.reduce(
    (sum, mr) => sum + mr.discussionCount,
    0,
  );
  AUTOMATION_BADGES.forEach((def) => {
    badges.push({
      ...def,
      unlocked: isBot ? botActionsCount >= def.threshold : false,
      progressText: isBot
        ? `${botActionsCount} / ${def.threshold} actions`
        : `Bot-only badge`,
    });
  });

  // One-time badges
  const oneTimeBadges: BadgeInfo[] = [
    {
      id: "first_steps",
      name: "First Steps",
      icon: "🌱",
      description: "Close your very first GitLab issue",
      track: "one-time",
      unlocked: userClosedIssueUrls.size >= 1,
      progressText:
        userClosedIssueUrls.size >= 1 ? "Unlocked" : "Close your first issue",
      xpReward: 10,
    },
    {
      id: "pr_pioneer",
      name: "PR Pioneer",
      icon: "🚀",
      description: "Have your very first authored MR successfully merged",
      track: "one-time",
      unlocked: mergedMrsCount >= 1,
      progressText: mergedMrsCount >= 1 ? "Unlocked" : "Merge your first MR",
      xpReward: 20,
    },
    {
      id: "sharp_shooter",
      name: "Sharp Shooter",
      icon: "🎯",
      description:
        "Close an issue where the logged time is within ±10% of the estimate",
      track: "one-time",
      unlocked: sharpShooterUnlocked,
      progressText: sharpShooterUnlocked
        ? "Unlocked"
        : "Close an issue within ±10% of estimate",
      xpReward: 50,
    },
    {
      id: "heavy_lifter",
      name: "Heavy Lifter",
      icon: "💪",
      description:
        "Successfully close a large issue with an estimate of 8+ hours",
      track: "one-time",
      unlocked: heavyLifterUnlocked,
      progressText: heavyLifterUnlocked
        ? "Unlocked"
        : "Close an 8h+ estimated issue",
      xpReward: 60,
    },
  ];

  badges.push(...oneTimeBadges);

  // --------------- Total XP and level ---------------
  const badgesXp = badges
    .filter((b) => b.unlocked)
    .reduce((sum, b) => sum + b.xpReward, 0);
  const totalXp = baseXp + badgesXp;
  const levelInfo = computeLevelInfo(totalXp);

  // --------------- Legacy fields for backward compat ---------------
  const maxSprintHours = activeSprintNumbers.reduce(
    (max, sp) => Math.max(max, sprintHoursMap[sp]),
    0,
  );
  const activeCategoriesCount = CATEGORY_DEFINITIONS.filter(
    (cat) => (categoryHours[cat.id] || 0) > 0,
  ).length;

  return {
    xp: totalXp,
    level: levelInfo.level,
    tierName: levelInfo.tierName,
    tierLabel: levelInfo.tierLabel,
    tierColor: levelInfo.tierColor,
    xpToNextLevel: levelInfo.xpToNextLevel,
    xpPercent: levelInfo.xpPercent,
    xpForCurrentLevel: levelInfo.xpForCurrentLevel,
    xpForNextLevel: levelInfo.xpForNextLevel,
    longestStreak,
    xpBreakdown: {
      hoursXp,
      issuesXp,
      blindFlightPenalty,
      sprintsXp,
      reviewsXp,
      badgesXp,
    },
    badges,
  };
}

// Re-export constants for use by other modules (e.g., tier colors in UI)
export const TIER_INFO = TIER_CONFIG;
export { xpNeededForLevel, computeLevelInfo };
