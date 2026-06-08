import { NextResponse } from "next/server";
import { getDescendantGroups } from "../../descendantGroups";
import { getMembers } from "../../group/[id]/members/route";
import { getTimelogs } from "../../group/[id]/timelogs/route";
import { generateSprints } from "../../group/[id]/sprints/route";
import { getMergeRequests } from "../../cache";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) => {
  try {
    const username = (await params).username;
    const { data: groups } = await getDescendantGroups();

    let userMemberInfo: any = null;
    const userTimelogs: any[] = [];
    const allTimelogsForGamification: any[] = []; // needed to compute gamification rank/streak accurately if they span groups
    const allMergeRequestsForGamification: any[] = [];

    const validatedTeammatesSet = new Set<string>();
    let userGroupTotalSeconds = 0;

    for (const group of groups) {
      const [timelogs, members, mergeRequests] = await Promise.all([
        getTimelogs(group.id).then((r) => r.data),
        getMembers(group.id).then((r) => r.data),
        getMergeRequests(group.id).then((r) => r.data),
      ]);

      allTimelogsForGamification.push(...timelogs);
      allMergeRequestsForGamification.push(...mergeRequests);

      const foundMember = members.find((m) => m.id.toLowerCase() === username.toLowerCase());
      if (foundMember) {
        userMemberInfo = {
          name: foundMember.name,
          avatarUrl: foundMember.avatarUrl,
          id: foundMember.id,
          url: foundMember.url,
          bot: foundMember.bot,
        };
        members.forEach((m) => {
          if (!m.bot && m.verified && m.id.toLowerCase() !== username.toLowerCase()) {
            validatedTeammatesSet.add(m.id.toLowerCase());
          }
        });
        // Compute group total hours for share calculation
        if (userGroupTotalSeconds === 0) {
          const humanMemberIds = members.filter((m) => !m.bot).map((m) => m.id.toLowerCase());
          userGroupTotalSeconds = timelogs
            .filter((log) => humanMemberIds.includes(log.username?.toLowerCase() || ""))
            .reduce((sum, log) => sum + log.timeSpent, 0);
        }
      }

      const filteredLogs = timelogs.filter((log) => log.username.toLowerCase() === username.toLowerCase());
      userTimelogs.push(...filteredLogs);
    }

    if (!userMemberInfo) {
      // Fallback if they haven't been found in any members list but have logged time
      if (userTimelogs.length > 0) {
        userMemberInfo = {
          name: username,
          avatarUrl: null,
          id: username,
          url: "",
          bot: false,
        };
      } else {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    }

    const sprints = generateSprints();

    const userTotalSeconds = userTimelogs.reduce((sum, log) => sum + log.timeSpent, 0);
    const groupSharePercent = userGroupTotalSeconds > 0
      ? +((userTotalSeconds / userGroupTotalSeconds) * 100).toFixed(1)
      : 0;

    return NextResponse.json({
      member: userMemberInfo,
      timelogs: userTimelogs,
      allTimelogsForGamification,
      allMergeRequestsForGamification,
      sprints,
      validatedTeammates: Array.from(validatedTeammatesSet),
      groupSharePercent,
    });
  } catch (error) {
    console.error("Failed to load user profile:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load user profile" },
      { status: 500 }
    );
  }
};
