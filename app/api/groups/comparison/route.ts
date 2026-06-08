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
  codeChurnBusFactor: number;
  peakHeroRelianceIndex: number;
  effortMultiplier: number;
  effortGap: number;
  coefficientOfVariation: number;
  reviewCoverage: number;
  groupWorkWeeks: number;
  groupMeanHours: number;
};

export type GroupComparisonResponse = {
  groups: GroupComparisonItem[];
};

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export const GET = async (request: Request) => {
  const { data: groups } = await getDescendantGroups();

  const comparisonData: GroupComparisonItem[] = [];

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

        const verifiedMembers = members.filter((m) => !m.bot && m.verified);
        const verifiedMemberIds = verifiedMembers.map((m) => m.id);

        // Compute per-user stats
        const userHours: Record<string, number> = {};
        const userChurn: Record<string, number> = {};
        const userLevel: Record<string, number> = {};

        for (const log of timelogs) {
          const uid = log.username?.toString() || "unknown";
          const uidLower = uid.toLowerCase();
          const member = verifiedMembers.find((m) => m.id.toLowerCase() === uidLower);
          if (member) {
            userHours[uidLower] = (userHours[uidLower] || 0) + log.timeSpent;
          }
        }

        for (const mr of mergeRequests) {
          const uid = mr.username?.toLowerCase() || "unknown";
          const member = verifiedMembers.find((m) => m.id.toLowerCase() === uid);
          if (member) {
            userChurn[uid] = (userChurn[uid] || 0) + (mr.additions || 0) + (mr.deletions || 0);
          }
        }

        // Group level from average member XP
        let totalXp = 0;
        let activeCount = 0;
        for (const member of verifiedMembers) {
          const validatedTeammates = verifiedMemberIds.filter((id) => id.toLowerCase() !== member.id.toLowerCase());
          const stats = computeGamification(member.id, timelogs, mergeRequests, false, validatedTeammates);
          userLevel[member.id.toLowerCase()] = stats.level;
          userHours[member.id.toLowerCase()] = userHours[member.id.toLowerCase()] || 0;
          if (stats.xp > 0) {
            totalXp += stats.xp;
            activeCount++;
          }
        }
        const avgXp = activeCount > 0 ? Math.floor(totalXp / activeCount) : 0;
        const levelInfo = computeLevelInfo(avgXp);

        // Code Churn Bus Factor
        const totalChurn = Object.values(userChurn).reduce((a, b) => a + b, 0);
        const churnShares = Object.values(userChurn).map((c) => totalChurn > 0 ? (c / totalChurn) * 100 : 0);
        const codeChurnBusFactor = churnShares.length > 0 ? Math.max(...churnShares) : 0;

        // Peak Hero Reliance Index
        const totalGroupHours = Object.values(userHours).reduce((a, b) => a + b, 0);
        const hourShares = Object.values(userHours)
          .filter((h) => h > 0)
          .map((h) => totalGroupHours > 0 ? (h / totalGroupHours) * 100 : 0);
        const peakHeroRelianceIndex = hourShares.length > 0 ? Math.max(...hourShares) : 0;

        // Effort dispersion stats
        const hourValues = Object.values(userHours).filter((h) => h > 0).sort((a, b) => a - b);
        const minH = hourValues.length > 0 ? hourValues[0] : 0;
        const maxH = hourValues.length > 0 ? hourValues[hourValues.length - 1] : 0;
        const effortMultiplier = minH > 0 ? maxH / minH : 0;
        const effortGap = (maxH - minH) / 3600;
        const meanH = hourValues.length > 0 ? hourValues.reduce((a, b) => a + b, 0) / hourValues.length : 0;
        const variance = hourValues.length > 1
          ? hourValues.reduce((acc, v) => acc + (v - meanH) ** 2, 0) / hourValues.length
          : 0;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = meanH > 0 ? stdDev / meanH : 0;

// Review Coverage: % of merged MRs (by verified members) with ≥1 peer review
        let reviewedCount = 0;
        let mergedCount = 0;
        const verifiedIdsLower = new Set(verifiedMembers.map((m) => m.id.toLowerCase()));
        for (const mr of mergeRequests) {
          if (mr.state !== "merged") continue;
          const author = mr.username?.toLowerCase();
          if (!author || !verifiedIdsLower.has(author)) continue;
          mergedCount++;
          const hasReview = [...(mr.approvedBy || []), ...(mr.discussionAuthors || [])]
            .some((r) => r.toLowerCase() !== author && verifiedIdsLower.has(r.toLowerCase()));
          if (hasReview) reviewedCount++;
        }
        const reviewCoverage = mergedCount > 0 ? (reviewedCount / mergedCount) * 100 : 0;

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
          codeChurnBusFactor: +codeChurnBusFactor.toFixed(1),
          peakHeroRelianceIndex: +peakHeroRelianceIndex.toFixed(1),
          effortMultiplier: +effortMultiplier.toFixed(1),
          effortGap: +effortGap.toFixed(1),
          coefficientOfVariation: +coefficientOfVariation.toFixed(3),
          reviewCoverage: +reviewCoverage.toFixed(1),
          groupWorkWeeks: +(totalHours / 40).toFixed(1),
          groupMeanHours: +(totalHours / Math.max(verifiedMembers.length, 1)).toFixed(1),
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

  return NextResponse.json({
    groups: comparisonData,
  });
};
