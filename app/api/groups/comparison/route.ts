import { NextResponse } from "next/server";
import { getDescendantGroups } from "../../descendantGroups";
import { getMembers } from "../../group/[id]/members/route";
import { getLabels } from "../../group/[id]/labels/route";
import { getTimelogs } from "../../group/[id]/timelogs/route";
import { computeCategorySummary } from "@/app/utils/categoryUtils";

export type MemberBrief = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bot: boolean;
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
};

export type GroupComparisonResponse = GroupComparisonItem[];

export const GET = async (request: Request) => {
  const { data: groups } = await getDescendantGroups();

  const results = await Promise.allSettled(
    groups.map(async (group) => {
      const [{ data: members }, { data: labels }, { data: timelogs }] =
        await Promise.all([
          getMembers(group.id),
          getLabels(group.id),
          getTimelogs(group.id),
        ]);

      const { categories, otherHours, otherLabels, totalHours } =
        computeCategorySummary(timelogs, labels);

      return {
        id: group.id,
        name: group.name,
        url: group.url,
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          avatarUrl: m.avatarUrl,
          bot: m.bot,
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
      };
    }),
  );

  const comparisonData: GroupComparisonResponse = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      comparisonData.push(result.value);
    } else {
      console.error("Failed to fetch group stats:", result.reason);
    }
  }

  return NextResponse.json(comparisonData);
};
