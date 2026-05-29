import { NextResponse } from "next/server";
import { getDescendantGroups } from "../../descendantGroups";
import { getMembers } from "../../group/[id]/members/route";
import { getTimelogs } from "../../group/[id]/timelogs/route";
import { matchLabelToCategory } from "@/app/utils/categoryUtils";
import { CATEGORY_DEFINITIONS } from "@/app/config/categories";
import { computeGamification } from "@/app/utils/gamification";
import { getMergeRequests } from "../../cache";

export type CategoryEntry = {
  categoryId: string;
  label: string;
  hours: number;
  color: string;
};

export type UserLeaderboardEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalHours: number;
  categoryBreakdown: CategoryEntry[];
  otherHours: number;
  groups: string[];
  level: number;
  xp: number;
};

export type UserLeaderboardResponse = UserLeaderboardEntry[];

export const GET = async (request: Request) => {
  const { data: groups } = await getDescendantGroups();

  const userMap: Record<
    string,
    {
      name: string;
      avatarUrl: string | null;
      groups: Set<string>;
      totalSeconds: number;
      categorySeconds: Record<string, number>;
      otherSeconds: number;
    }
  > = {};

  const allTimelogs: any[] = [];
  const allMergeRequests: any[] = [];

  for (const group of groups) {
    const [timelogs, members, mergeRequests] = await Promise.all([
      getTimelogs(group.id).then((r) => r.data),
      getMembers(group.id).then((r) => r.data),
      getMergeRequests(group.id).then((r) => r.data),
    ]);

    allTimelogs.push(...timelogs);
    allMergeRequests.push(...mergeRequests);

    const memberMap = new Map(
      members.map((m) => [m.id, { name: m.name, avatarUrl: m.avatarUrl }]),
    );

    for (const log of timelogs) {
      const userId = log.username || "unknown";
      if (!userMap[userId]) {
        const info = memberMap.get(userId);
        userMap[userId] = {
          name: info?.name || userId,
          avatarUrl: info?.avatarUrl || null,
          groups: new Set(),
          totalSeconds: 0,
          categorySeconds: {},
          otherSeconds: 0,
        };
      }

      // Fill name/avatar from any group this user appears in
      const memberInfo = memberMap.get(userId);
      if (memberInfo) {
        if (!userMap[userId].avatarUrl)
          userMap[userId].avatarUrl = memberInfo.avatarUrl;
      }

      userMap[userId].groups.add(group.name);
      userMap[userId].totalSeconds += log.timeSpent;

      let assigned = false;
      for (const label of log.issueLabels || []) {
        const catDef = matchLabelToCategory(label);
        if (catDef) {
          userMap[userId].categorySeconds[catDef.id] =
            (userMap[userId].categorySeconds[catDef.id] || 0) + log.timeSpent;
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        userMap[userId].otherSeconds += log.timeSpent;
      }
    }
  }

  const leaderboard = Object.entries(userMap)
    .map(([userId, u]) => {
      const categoryBreakdown = CATEGORY_DEFINITIONS.map((def) => ({
        categoryId: def.id,
        label: def.label,
        hours: +((u.categorySeconds[def.id] || 0) / 3600).toFixed(1),
        color: def.color,
      }));

      const gamification = computeGamification(userId, allTimelogs, allMergeRequests);

      return {
        userId,
        name: u.name,
        avatarUrl: u.avatarUrl,
        totalHours: +(u.totalSeconds / 3600).toFixed(1),
        categoryBreakdown,
        otherHours: +((u.otherSeconds || 0) / 3600).toFixed(1),
        groups: Array.from(u.groups).sort(),
        level: gamification.level,
        xp: gamification.xp,
      };
    })
    .filter((u) => u.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours);

  return NextResponse.json(leaderboard);
};
