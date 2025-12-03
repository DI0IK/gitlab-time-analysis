import { NextResponse } from "next/server";
import { GITLAB_GROUP_PATH } from "../../../env";
import { runGitlabGraphQLQuery } from "../../../gitlab";

export const revalidate = 60;

const cache: {
  [groupId: string]: { data: GroupMembersResponse; timestamp: number };
} = {};

export type GroupMembersResponse = {
  id: string;
  name: string;
  url: string;
  bot: boolean;
}[];

export async function getMembers(groupId: string) {
  const fullGroupPath = `${GITLAB_GROUP_PATH}/${groupId}`;

  if (cache[fullGroupPath]) {
    const cached = cache[fullGroupPath];
    const now = Date.now();
    // Cache for 5 minutes
    if (now - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }
  }

  const data = await runGitlabGraphQLQuery(`
    {
      group(fullPath: "${fullGroupPath}") {
        groupMembers(accessLevels: [OWNER, MAINTAINER, ADMIN], relations: [DIRECT]) {
          nodes {
            user {
              username
              name
              webUrl
              bot
            }
          }
        }
      }
    }
  `);

  const dataInferred = await runGitlabGraphQLQuery(`
    {
      group(fullPath: "${fullGroupPath}") {
        timelogs(last: 1000) {
          nodes {
            user {
              username
              name
              webUrl
              bot
            }
          }
        }
      }
    }
  `);

  const inferredMembers = dataInferred.data.group.timelogs.nodes.map(
    (log: {
      user: { username: string; name: string; webUrl: string; bot: boolean };
    }) => ({
      id: log.user.username,
      name: log.user.name,
      url: log.user.webUrl,
      bot: log.user.bot,
    })
  );

  const explicitMembers = data.data.group.groupMembers.nodes.map(
    (member: {
      user: { username: string; name: string; webUrl: string; bot: boolean };
    }) => ({
      id: member.user.username,
      name: member.user.name,
      url: member.user.webUrl,
      bot: member.user.bot,
    })
  );

  const allMembersMap: {
    [key: string]: { id: string; name: string; url: string; bot: boolean };
  } = {};

  explicitMembers.forEach(
    (member: { id: string; name: string; url: string; bot: boolean }) => {
      allMembersMap[member.id] = member;
    }
  );

  inferredMembers.forEach(
    (member: { id: string; name: string; url: string; bot: boolean }) => {
      allMembersMap[member.id] = member;
    }
  );

  const allMembers = Object.values(allMembersMap);
  cache[fullGroupPath] = {
    data: allMembers,
    timestamp: Date.now(),
  };
  return allMembers;
}

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const groupId = (await params).id;

  return NextResponse.json(await getMembers(groupId));
};
