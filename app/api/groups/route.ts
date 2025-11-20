import { NextResponse } from "next/server";
import { GITLAB_DOMAIN, GITLAB_GROUP_PATH } from "../env";
import { runGitlabGraphQLQuery } from "../gitlab";

export type GroupResponse = {
  id: string;
  name: string;
  url: string;
}[];

export const GET = async () => {
  const data = await runGitlabGraphQLQuery(`
    {
      group(fullPath: "${GITLAB_GROUP_PATH}") {
        descendantGroups {
          nodes {
            fullPath
            name
          }
        }
      }
    }
  `);

  return new NextResponse(
    JSON.stringify(
      data.data.group.descendantGroups.nodes.map(
        (group: { fullPath: string; name: string }) => ({
          id: group.fullPath.replace(GITLAB_GROUP_PATH + "/", ""),
          name: group.name,
          url: `${GITLAB_DOMAIN || "https://gitlab.com"}/${group.fullPath}`,
        })
      )
    ),
    {
      status: 200,
    }
  );
};
