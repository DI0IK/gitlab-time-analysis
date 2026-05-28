import { NextResponse } from "next/server";
import { getDescendantGroups } from "../../descendantGroups";
import { getMembers } from "../../group/[id]/members/route";
import { getTimelogs } from "../../group/[id]/timelogs/route";
import { generateSprints } from "../../group/[id]/sprints/route";

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

    for (const group of groups) {
      const [timelogs, members] = await Promise.all([
        getTimelogs(group.id).then((r) => r.data),
        getMembers(group.id).then((r) => r.data),
      ]);

      allTimelogsForGamification.push(...timelogs);

      const foundMember = members.find((m) => m.id === username);
      if (foundMember) {
        userMemberInfo = {
          name: foundMember.name,
          avatarUrl: foundMember.avatarUrl,
          id: foundMember.id,
          url: foundMember.url,
          bot: foundMember.bot,
        };
      }

      const filteredLogs = timelogs.filter((log) => log.username === username);
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

    return NextResponse.json({
      member: userMemberInfo,
      timelogs: userTimelogs,
      allTimelogsForGamification, // to let frontend compute gamification stats for all logs
      sprints,
    });
  } catch (error) {
    console.error("Failed to load user profile:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load user profile" },
      { status: 500 }
    );
  }
};
