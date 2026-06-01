import { NextResponse } from "next/server";
import { getDescendantGroups } from "../../descendantGroups";
import { getMembers } from "../../group/[id]/members/route";
import { getLabels } from "../../group/[id]/labels/route";
import { getTimelogs } from "../../group/[id]/timelogs/route";
import { getMergeRequests } from "../../cache";
import { computeCategorySummary } from "@/app/utils/categoryUtils";
import { computeGamification, computeLevelInfo, TIER_INFO } from "@/app/utils/gamification";

export type MemberBrief = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bot: boolean;
  verified: boolean;
};

export type CategoryBreakdown = {
  id: string;
  label: string;
  hours: number;
  color: string;
  matchedLabels: string[];
};

export type GroupComparisonItem = {
  id: string;
  name: string;
  url: string;
  members: MemberBrief[];
  categoryBreakdown: CategoryBreakdown[];
  otherHours: number;
  otherLabels: string[];
  totalHours: number;
  groupLevel: number;
  groupTierName: string;
  groupTierColor: string;
  groupAvgXp: number;
};

export type GroupComparisonResponse = GroupComparisonItem[];

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export const GET = async (request: Request) => {
  const { data: groups } = await getDescendantGroups();

  const comparisonData: GroupComparisonResponse = [];

  for (const batch of chunk(groups, 2)) {
    const results = await Promise.allSettled(
      batch.map(async (group) => {
        const [{ data: members }, { data: labels }, { data: timelogs }, { data: mergeRequests }] =
          await Promise.all([
            getMembers(group.id),
            getLabels(group.id),
            getTimelogs(group.id),
            getMergeRequests(group.id),
          ]);

        const { categories, otherHours, otherLabels, totalHours } =
          computeCategorySummary(timelogs, labels);

        // Compute group level from average member XP
        const humanMembers = members.filter((m) => !m.bot);
        const verifiedMembers = humanMembers.filter((m) => m.verified);
        let totalXp = 0;
        for (const member of verifiedMembers) {
          const stats = computeGamification(member.id, timelogs, mergeRequests);
          totalXp += stats.xp;
        }
        const avgXp = verifiedMembers.length > 0 ? Math.floor(totalXp / verifiedMembers.length) : 0;
        const levelInfo = computeLevelInfo(avgXp);

        return {
          id: group.id,
          name: group.name,
          url: group.url,
          members: members.map((m) => ({
            id: m.id,
            name: m.name,
            avatarUrl: m.avatarUrl,
            bot: m.bot,
            verified: m.verified,
          })),
          categoryBreakdown: categories.map((c) => ({
            id: c.categoryId,
            label: c.shortLabel,
            hours: c.hours,
            color: c.color,
            matchedLabels: c.matchedLabels,
          })),
          otherHours,
          otherLabels,
          totalHours,
          groupLevel: levelInfo.level,
          groupTierName: levelInfo.tierLabel,
          groupTierColor: levelInfo.tierColor,
          groupAvgXp: avgXp,
        };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        comparisonData.push(result.value);
      } else {
        console.error("Failed to fetch group stats:", result.reason);
      }
    }
  }

  return NextResponse.json(comparisonData);
};
