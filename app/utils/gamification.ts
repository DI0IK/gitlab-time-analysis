import { matchLabelToCategory, CATEGORY_DEFINITIONS } from "../config/categories";
import { GroupTimelogsResponse } from "../api/group/[id]/timelogs/route";

export type GamificationStats = {
  xp: number;
  level: number;
  xpToNextLevel: number;
  xpPercent: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  longestStreak: number;
  xpBreakdown: {
    hoursXp: number;
    issuesXp: number;
    sprintsXp: number;
    badgesXp: number;
    perfectEstimateXp: number;
    underBudgetXp: number;
    perfectWeeksXp: number;
    longWeeksXp: number;
    speedDemonXp: number;
    heavyLifterXp: number;
  };
  badges: {
    id: string;
    name: string;
    icon: string;
    description: string;
    unlocked: boolean;
    progressText: string;
    xpReward: number;
  }[];
};

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

export function computeGamification(
  username: string,
  timelogs: GroupTimelogsResponse
): GamificationStats {
  const userLogs = timelogs.filter((log) => log.username === username);

  // 1. Total hours
  const totalHours = userLogs.reduce((sum, log) => sum + log.timeSpent, 0) / 3600;

  // 2. Unique issues
  const uniqueIssues = new Set(userLogs.filter(log => log.issueUrl).map(log => log.issueUrl));

  // 3. Sprint-level data
  const sprintHoursMap: Record<number, number> = {};
  userLogs.forEach((log) => {
    if (log.sprintNumber !== undefined && log.sprintNumber !== null) {
      sprintHoursMap[log.sprintNumber] = (sprintHoursMap[log.sprintNumber] || 0) + log.timeSpent / 3600;
    }
  });

  const activeSprints = Object.keys(sprintHoursMap).map(Number).sort((a, b) => a - b);
  const longestStreak = longestConsecutiveRun(activeSprints);
  const maxSprintHours = activeSprints.reduce((max, sp) => Math.max(max, sprintHoursMap[sp]), 0);

  // 4. Categories worked
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

  const activeCategoriesCount = CATEGORY_DEFINITIONS.filter((cat) => (categoryHours[cat.id] || 0) > 0).length;

  // Find max category hours & percentage
  let maxCategoryHours = 0;
  let maxCategoryName = "None";

  Object.entries(categoryHours).forEach(([id, hours]) => {
    if (hours > maxCategoryHours) {
      maxCategoryHours = hours;
      if (id === "other") {
        maxCategoryName = "Other";
      } else {
        const catDef = CATEGORY_DEFINITIONS.find((c) => c.id === id);
        maxCategoryName = catDef ? catDef.label : "Other";
      }
    }
  });

  const maxCategoryPercentage = totalHours > 0 ? (maxCategoryHours / totalHours) * 100 : 0;

  // 5. XP Breakdown
  let perfectEstimateCount = 0;
  let underBudgetCount = 0;
  let efficientIssuesCount = 0;
  let speedDemonCount = 0;
  let heavyLifterCount = 0;

  Array.from(uniqueIssues).forEach((issueUrl) => {
    const issueLogs = timelogs.filter((log) => log.issueUrl === issueUrl);
    if (issueLogs.length > 0) {
      const estimate = issueLogs[0].issueTimeEstimate; // seconds
      const userIssueLogs = issueLogs.filter(log => log.username === username);
      const totalActualSpent = issueLogs.reduce((sum, log) => sum + log.timeSpent, 0);

      // Check for estimation efficiency
      if (totalActualSpent <= estimate) {
        efficientIssuesCount++;
      }

      if (estimate > 0) {
        // Only closed/completed issues (estimate is set, time has been logged, we can analyze closeness)
        const diffPercent = Math.abs(totalActualSpent - estimate) / estimate;
        if (diffPercent <= 0.05) {
          perfectEstimateCount++;
        } else if (totalActualSpent < estimate) {
          underBudgetCount++;
        }
      }

      // Speed Demon: user's latest timelog is within 48 hours of issue creation
      if (userIssueLogs.length > 0) {
        const issueCreatedAtStr = (userIssueLogs[0] as any).issueCreatedAt;
        if (issueCreatedAtStr) {
          const creationTime = new Date(issueCreatedAtStr).getTime();
          const spentDates = userIssueLogs.map(log => new Date(log.spentAt).getTime());
          const maxDate = Math.max(...spentDates);
          const diffHours = (maxDate - creationTime) / (1000 * 60 * 60);
          // Only award if it is positive (logged after creation) and within 48 hours
          if (diffHours >= 0 && diffHours <= 48) {
            speedDemonCount++;
          }
        }
      }

      // Heavy Lifter: user completed (logged hours on) an issue with estimate >= 8h
      if (estimate >= 8 * 3600 && userIssueLogs.length > 0) {
        heavyLifterCount++;
      }
    }
  });

  // Perfect Weeks: Sprint hours between 3.5h and 5h
  const perfectWeeksCount = Object.values(sprintHoursMap).filter((h) => h >= 3.5 && h <= 5.0).length;
  // Long Weeks: Logarithmic XP scaling for sprints exceeding 4.0h (diminishing returns to prevent grinding).
  const longWeeksXp = Object.values(sprintHoursMap)
    .filter((h) => h > 4.0)
    .reduce((sum, h) => sum + Math.floor(30 * Math.log(1 + (h - 4.0))), 0);

  const perfectEstimateXp = perfectEstimateCount * 15;
  const underBudgetXp = underBudgetCount * 10;
  const speedDemonXp = speedDemonCount * 10;
  const heavyLifterXp = heavyLifterCount * 40;
  const perfectWeeksXp = perfectWeeksCount * 50;

  const hoursXp = Math.floor(totalHours * 15);
  const issuesXp = uniqueIssues.size * 5;
  const sprintsXp = activeSprints.length * 25;
  const otherBonusesXp =
    perfectEstimateXp +
    underBudgetXp +
    speedDemonXp +
    heavyLifterXp +
    perfectWeeksXp +
    longWeeksXp;

  const baseHrsXp = hoursXp + issuesXp + sprintsXp + otherBonusesXp;
  const issueCount = uniqueIssues.size;

  // Static base badges list (without level dependencies)
  const baseBadges = [
    {
      id: "hours_bronze",
      name: "Greenhorn",
      icon: "⏱️",
      description: "Log at least 1 hour of work",
      unlocked: totalHours >= 1,
      progressText: `${totalHours.toFixed(1)} / 1 h`,
      xpReward: 15,
    },
    {
      id: "hours_silver",
      name: "Apprentice",
      icon: "🔨",
      description: "Log at least 10 hours of work",
      unlocked: totalHours >= 10,
      progressText: `${totalHours.toFixed(1)} / 10 h`,
      xpReward: 50,
    },
    {
      id: "hours_gold",
      name: "Dedicated Worker",
      icon: "💪",
      description: "Log at least 30 hours of work",
      unlocked: totalHours >= 30,
      progressText: `${totalHours.toFixed(1)} / 30 h`,
      xpReward: 100,
    },
    {
      id: "hours_platinum",
      name: "Deep Worker",
      icon: "🧠",
      description: "Log at least 60 hours of work",
      unlocked: totalHours >= 60,
      progressText: `${totalHours.toFixed(1)} / 60 h`,
      xpReward: 150,
    },
    {
      id: "hours_emerald",
      name: "Century Club",
      icon: "💯",
      description: "Log at least 100 hours of work",
      unlocked: totalHours >= 100,
      progressText: `${totalHours.toFixed(1)} / 100 h`,
      xpReward: 200,
    },
    {
      id: "hours_diamond",
      name: "Workaholic",
      icon: "👑",
      description: "Log at least 150 hours of work",
      unlocked: totalHours >= 150,
      progressText: `${totalHours.toFixed(1)} / 150 h`,
      xpReward: 250,
    },
    {
      id: "hours_legendary",
      name: "Absolute Legend",
      icon: "🌌",
      description: "Log at least 250 hours of work",
      unlocked: totalHours >= 250,
      progressText: `${totalHours.toFixed(1)} / 250 h`,
      xpReward: 500,
    },
    {
      id: "first_issue",
      name: "First Steps",
      icon: "📌",
      description: "Contribute to your first issue",
      unlocked: issueCount >= 1,
      progressText: `${issueCount} / 1 issue`,
      xpReward: 10,
    },
    {
      id: "issue_bronze",
      name: "Task Solver",
      icon: "🎯",
      description: "Contribute to at least 5 unique issues",
      unlocked: issueCount >= 5,
      progressText: `${issueCount} / 5 issues`,
      xpReward: 25,
    },
    {
      id: "issue_silver",
      name: "Problem Solver",
      icon: "🔍",
      description: "Contribute to at least 12 unique issues",
      unlocked: issueCount >= 12,
      progressText: `${issueCount} / 12 issues`,
      xpReward: 50,
    },
    {
      id: "issue_gold",
      name: "Issue Sweeper",
      icon: "⚡",
      description: "Contribute to at least 20 unique issues",
      unlocked: issueCount >= 20,
      progressText: `${issueCount} / 20 issues`,
      xpReward: 75,
    },
    {
      id: "issue_platinum",
      name: "Code Crusader",
      icon: "🛡️",
      description: "Contribute to at least 35 unique issues",
      unlocked: issueCount >= 35,
      progressText: `${issueCount} / 35 issues`,
      xpReward: 150,
    },
    {
      id: "issue_diamond",
      name: "Task Master",
      icon: "🏆",
      description: "Contribute to at least 50 unique issues",
      unlocked: issueCount >= 50,
      progressText: `${issueCount} / 50 issues`,
      xpReward: 250,
    },
    {
      id: "streak_bronze",
      name: "Sprint Jogger",
      icon: "👟",
      description: "Log hours in 2 or more consecutive sprints",
      unlocked: longestStreak >= 2,
      progressText: `${longestStreak} / 2 consecutive`,
      xpReward: 20,
    },
    {
      id: "streak_silver",
      name: "Sprint Runner",
      icon: "🚀",
      description: "Log hours in 4 or more consecutive sprints",
      unlocked: longestStreak >= 4,
      progressText: `${longestStreak} / 4 consecutive`,
      xpReward: 50,
    },
    {
      id: "streak_gold",
      name: "Sprint Machine",
      icon: "🔥",
      description: "Log hours in 6 or more consecutive sprints",
      unlocked: longestStreak >= 6,
      progressText: `${longestStreak} / 6 consecutive`,
      xpReward: 100,
    },
    {
      id: "streak_platinum",
      name: "Consistent Contributor",
      icon: "📅",
      description: "Log hours in 8 or more consecutive sprints",
      unlocked: longestStreak >= 8,
      progressText: `${longestStreak} / 8 consecutive`,
      xpReward: 150,
    },
    {
      id: "streak_diamond",
      name: "Sprint Overlord",
      icon: "👾",
      description: "Log hours in 10 or more consecutive sprints",
      unlocked: longestStreak >= 10,
      progressText: `${longestStreak} / 10 consecutive`,
      xpReward: 250,
    },
    {
      id: "specialist",
      name: "Specialist",
      icon: "🔬",
      description: "More than 50% of your logged time is in one category",
      unlocked: maxCategoryPercentage >= 50,
      progressText: totalHours > 0 ? `${maxCategoryPercentage.toFixed(0)}% / 50% (${maxCategoryName})` : "0% / 50%",
      xpReward: 50,
    },
    {
      id: "efficient_bronze",
      name: "Efficient Estimator",
      icon: "✅",
      description: "Complete 2+ issues within their time estimate",
      unlocked: efficientIssuesCount >= 2,
      progressText: `${efficientIssuesCount} / 2 issues`,
      xpReward: 50,
    },
    {
      id: "efficient_silver",
      name: "Perfect Precision",
      icon: "🎯",
      description: "Complete 5+ issues within their time estimate",
      unlocked: efficientIssuesCount >= 5,
      progressText: `${efficientIssuesCount} / 5 issues`,
      xpReward: 100,
    },
    {
      id: "big_sprint_bronze",
      name: "Sprint Burst",
      icon: "⚡",
      description: "Log at least 8 hours in any single sprint",
      unlocked: maxSprintHours >= 8,
      progressText: `${maxSprintHours.toFixed(1)} / 8 h`,
      xpReward: 75,
    },
    {
      id: "big_sprint_silver",
      name: "Workhorse Week",
      icon: "🌟",
      description: "Log at least 15 hours in any single sprint",
      unlocked: maxSprintHours >= 15,
      progressText: `${maxSprintHours.toFixed(1)} / 15 h`,
      xpReward: 150,
    },
  ];

  const XP_PER_LEVEL_FACTOR = 12.5;

  // Calculate preliminary level to determine "Ultimate Rank" badge status
  const preliminaryBadgesXp = baseBadges
    .filter((b) => b.unlocked)
    .reduce((sum, b) => sum + b.xpReward, 0);
  const preliminaryXp = baseHrsXp + preliminaryBadgesXp;
  const preliminaryLevel = Math.min(100, Math.floor(Math.sqrt(preliminaryXp / XP_PER_LEVEL_FACTOR)) + 1);

  // Ultimate Rank Badge
  const levelBadge = {
    id: "gamification_level_tier",
    name: "Ultimate Rank",
    icon: "👑",
    description: "Reach level 20 or higher",
    unlocked: preliminaryLevel >= 20,
    progressText: `Lv. ${preliminaryLevel} / 20`,
    xpReward: 200,
  };

  const badgesList = [...baseBadges, levelBadge];

  // Final calculations
  const badgesXp = badgesList
    .filter((b) => b.unlocked)
    .reduce((sum, b) => sum + b.xpReward, 0);

  const xp = baseHrsXp + badgesXp;
  const level = Math.min(100, Math.floor(Math.sqrt(xp / XP_PER_LEVEL_FACTOR)) + 1);

  // Sync the levelBadge with final level
  levelBadge.progressText = `Lv. ${level} / 20`;
  levelBadge.unlocked = level >= 20;

  const xpForCurrentLevel = (level - 1) ** 2 * XP_PER_LEVEL_FACTOR;
  const xpForNextLevel = level ** 2 * XP_PER_LEVEL_FACTOR;
  const xpToNextLevel = level >= 100 ? 0 : xpForNextLevel - xp;
  const xpPercent =
    level >= 100
      ? 100
      : Math.min(
        100,
        ((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100,
      );

  return {
    xp,
    level,
    xpToNextLevel,
    xpPercent,
    xpForCurrentLevel,
    xpForNextLevel,
    longestStreak,
    xpBreakdown: {
      hoursXp,
      issuesXp,
      sprintsXp,
      badgesXp,
      perfectEstimateXp,
      underBudgetXp,
      perfectWeeksXp,
      longWeeksXp,
      speedDemonXp,
      heavyLifterXp,
    },
    badges: badgesList,
  };
}
