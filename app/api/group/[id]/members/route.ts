import { NextResponse } from "next/server";
import { GITLAB_GROUP_PATH, GITLAB_DOMAIN } from "../../../env";
import { runGitlabGraphQLQuery } from "../../../gitlab";

export const revalidate = 60;

export type GroupMembersResponse = {
  id: string;
  name: string;
  url: string;
  bot: boolean;
  avatarUrl: string | null;
}[];

// Updated cache type to handle background promises and prevent duplicate fetches
type CacheEntry = {
  data: GroupMembersResponse | null;
  timestamp: number;
  fetchPromise: Promise<GroupMembersResponse> | null;
};

const cache: { [fullGroupPath: string]: CacheEntry } = {};
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Convert relative avatar URLs to absolute URLs
 * GitLab returns avatarUrl as relative paths, we need to prepend the domain
 */
function normalizeAvatarUrl(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  
  // If it's already absolute, return as-is
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }
  
  // If it's a relative URL, prepend the GitLab domain
  if (avatarUrl.startsWith("/")) {
    const domain = GITLAB_DOMAIN || "https://gitlab.com";
    return `${domain}${avatarUrl}`;
  }
  
  return avatarUrl;
}

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
              avatarUrl
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
              avatarUrl
            }
          }
        }
      }
    }
  `);

  const inferredMembers = dataInferred.data.group.timelogs.nodes.map(
    (log: {
      user: { username: string; name: string; webUrl: string; bot: boolean; avatarUrl: string };
    }) => ({
      id: log.user.username,
      name: log.user.name,
      url: log.user.webUrl,
      bot: log.user.bot,
      avatarUrl: normalizeAvatarUrl(log.user.avatarUrl || null),
    }),
  );

  const explicitMembers = data.data.group.groupMembers.nodes.map(
    (member: {
      user: { username: string; name: string; webUrl: string; bot: boolean; avatarUrl: string };
    }) => ({
      id: member.user.username,
      name: member.user.name,
      url: member.user.webUrl,
      bot: member.user.bot,
      avatarUrl: normalizeAvatarUrl(member.user.avatarUrl || null),
    }),
  );

  const allMembersMap: {
    [key: string]: { id: string; name: string; url: string; bot: boolean; avatarUrl: string | null };
  } = {};

  explicitMembers.forEach(
    (member: { id: string; name: string; url: string; bot: boolean; avatarUrl: string | null }) => {
      allMembersMap[member.id] = member;
    },
  );

  inferredMembers.forEach(
    (member: { id: string; name: string; url: string; bot: boolean; avatarUrl: string | null }) => {
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
    return { data: cached.data, timestamp: cached.timestamp };
  }

  // If we have NO data at all (first ever request), we MUST wait for the fetch to finish
  const freshData = await cached.fetchPromise!;
  return { data: freshData, timestamp: cache[fullGroupPath].timestamp };
}

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const groupId = (await params).id;

  const { data, timestamp } = await getMembers(groupId);
  return NextResponse.json(data, {
    headers: { "x-cache-timestamp": String(timestamp) },
  });
};
