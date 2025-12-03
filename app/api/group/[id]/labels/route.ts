import { NextResponse } from "next/server";
import { GITLAB_GROUP_PATH } from "../../../env";
import { runGitlabGraphQLQuery } from "../../../gitlab";

export const revalidate = 60;

const cache: {
  [groupId: string]: { data: GroupLabelsResponse; timestamp: number };
} = {};

export type GroupLabelsResponse = {
  [labelGroup: string]: {
    id: string;
    title: string;
    description: string;
    color: string;
  }[];
};

export async function getLabels(groupId: string) {
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
        labels {
          nodes {
            title
            description
            color
          }
        }
      }
    }
  `);

  const response = data.data.group.labels.nodes.reduce(
    (
      acc: GroupLabelsResponse,
      label: { title: string; description: string; color: string }
    ) => {
      const group =
        label.title.split("::").length > 1
          ? label.title.split("::")[0]
          : "Ungrouped";
      const title =
        label.title.split("::").length > 1
          ? label.title.split("::").slice(1).join("::")
          : label.title;
      const modifiedLabel = {
        id: group + "::" + title,
        title: title,
        description: label.description,
        color: label.color,
      };
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(modifiedLabel);
      return acc;
    },
    {}
  );

  cache[fullGroupPath] = {
    data: response,
    timestamp: Date.now(),
  };

  return response;
}

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const groupId = (await params).id;

  return NextResponse.json(await getLabels(groupId));
};
