import { NextResponse } from "next/server";
import { GITLAB_GROUP_PATH } from "../../../env";
import { runGitlabGraphQLQuery } from "../../../gitlab";

export const revalidate = 60;

export type GroupMembersResponse = {
  id: string;
  name: string;
  url: string;
}[];

export async function getMembers(groupId: string) {
  const fullGroupPath = `${GITLAB_GROUP_PATH}/${groupId}`;

  const data = await runGitlabGraphQLQuery(`
    {
      group(fullPath: "${fullGroupPath}") {
        groupMembers(accessLevels: [OWNER, MAINTAINER, ADMIN], relations: [DIRECT]) {
          nodes {
            user {
              username
              name
              webUrl
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
            }
          }
        }
      }
    }
  `);

  const inferredMembers = dataInferred.data.group.timelogs.nodes.map(
    (log: { user: { username: string; name: string; webUrl: string } }) => ({
      id: log.user.username,
      name: log.user.name,
      url: log.user.webUrl,
    })
  );

  const explicitMembers = data.data.group.groupMembers.nodes.map(
    (member: { user: { username: string; name: string; webUrl: string } }) => ({
      id: member.user.username,
      name: member.user.name,
      url: member.user.webUrl,
    })
  );

  const allMembersMap: {
    [key: string]: { id: string; name: string; url: string };
  } = {};

  explicitMembers.forEach(
    (member: { id: string; name: string; url: string }) => {
      allMembersMap[member.id] = member;
    }
  );

  inferredMembers.forEach(
    (member: { id: string; name: string; url: string }) => {
      allMembersMap[member.id] = member;
    }
  );

  const allMembers = Object.values(allMembersMap);
  return allMembers;
}

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const groupId = (await params).id;

  return NextResponse.json(await getMembers(groupId));
};
