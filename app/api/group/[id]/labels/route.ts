import { NextResponse } from "next/server";
import { GITLAB_GROUP_PATH } from "../../../env";
import { runGitlabGraphQLQuery } from "../../../gitlab";

export const revalidate = 60;

export type GroupLabelsResponse = {
  [labelGroup: string]: {
    id: string;
    title: string;
    description: string;
    color: string;
  }[];
};

// Updated cache type to handle background promises and prevent duplicate fetches
type CacheEntry = {
  data: GroupLabelsResponse | null;
  timestamp: number;
  fetchPromise: Promise<GroupLabelsResponse> | null;
};

const cache: { [fullGroupPath: string]: CacheEntry } = {};
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

// Extracted fetch and processing logic
async function fetchAndProcessLabels(
  fullGroupPath: string,
): Promise<GroupLabelsResponse> {
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

  return data.data.group.labels.nodes.reduce(
    (
      acc: GroupLabelsResponse,
      label: { title: string; description: string; color: string },
    ) => {
      const group =
        label.title.split("::").length > 1
          ? label.title.split("::")[0]
          : label.title.split(":").length > 1
            ? label.title.split(":")[0]
            : "Ungrouped";
      const title =
        label.title.split("::").length > 1
          ? label.title.split("::").slice(1).join("::")
          : label.title.split(":").length > 1
            ? label.title.split(":").slice(1).join(":")
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
    {},
  );
}

export async function getLabels(groupId: string) {
  const fullGroupPath = `${GITLAB_GROUP_PATH}/${groupId}`;
  const now = Date.now();

  // Initialize cache entry if it doesn't exist
  if (!cache[fullGroupPath]) {
    cache[fullGroupPath] = {
      data: null,
      timestamp: 0,
      fetchPromise: null,
    };
  }

  const cached = cache[fullGroupPath];
  const isStale = now - cached.timestamp >= CACHE_TTL_MS;

  // If the data is stale (or missing) AND no background refresh is currently running
  if (isStale && !cached.fetchPromise) {
    // Start background refresh and store the promise to prevent duplicate fetches
    cached.fetchPromise = fetchAndProcessLabels(fullGroupPath)
      .then((freshData) => {
        cache[fullGroupPath] = {
          data: freshData,
          timestamp: Date.now(),
          fetchPromise: null, // Clear the promise once finished
        };
        return freshData;
      })
      .catch((error) => {
        console.error("Failed to refresh labels background cache:", error);
        cache[fullGroupPath].fetchPromise = null; // Free up for next attempt
        throw error;
      });
  }

  // If we already have stale data, serve it immediately (Stale-While-Revalidate)
  if (cached.data) {
    // Catch potential unhandled promise rejections since we are not awaiting it here
    cached.fetchPromise?.catch(() => {});
    return cached.data;
  }

  // If we have NO data at all (first ever request), we MUST wait for the fetch to finish
  return await cached.fetchPromise!;
}

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const groupId = (await params).id;

  return NextResponse.json(await getLabels(groupId));
};
