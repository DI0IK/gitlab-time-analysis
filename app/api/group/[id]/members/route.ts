import { NextResponse } from "next/server";
import { GITLAB_GROUP_PATH } from "../../../env";
import { runGitlabGraphQLQuery } from "../../../gitlab";

export const revalidate = 60;

export type GroupMembersResponse = {
  id: string;
  name: string;
  url: string;
  bot: boolean;
}[];

// Updated cache type to handle background promises and prevent duplicate fetches
type CacheEntry = {
  data: GroupMembersResponse | null;
  timestamp: number;
  fetchPromise: Promise<GroupMembersResponse> | null;
};

const cache: { [fullGroupPath: string]: CacheEntry } = {};
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

// Extracted fetch and processing logic
async function fetchAndProcessMembers(
  fullGroupPath: string,
): Promise<GroupMembersResponse> {
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
    }),
  );

  const explicitMembers = data.data.group.groupMembers.nodes.map(
    (member: {
      user: { username: string; name: string; webUrl: string; bot: boolean };
    }) => ({
      id: member.user.username,
      name: member.user.name,
      url: member.user.webUrl,
      bot: member.user.bot,
    }),
  );

  const allMembersMap: {
    [key: string]: { id: string; name: string; url: string; bot: boolean };
  } = {};

  explicitMembers.forEach(
    (member: { id: string; name: string; url: string; bot: boolean }) => {
      allMembersMap[member.id] = member;
    },
  );

  inferredMembers.forEach(
    (member: { id: string; name: string; url: string; bot: boolean }) => {
      if (member.id) {
        // Safeguard against null users in timelogs
        allMembersMap[member.id] = member;
      }
    },
  );

  return Object.values(allMembersMap);
}

export async function getMembers(groupId: string) {
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
    cached.fetchPromise = fetchAndProcessMembers(fullGroupPath)
      .then((freshData) => {
        cache[fullGroupPath] = {
          data: freshData,
          timestamp: Date.now(),
          fetchPromise: null, // Clear the promise once finished
        };
        return freshData;
      })
      .catch((error) => {
        console.error("Failed to refresh members background cache:", error);
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

  return NextResponse.json(await getMembers(groupId));
};
