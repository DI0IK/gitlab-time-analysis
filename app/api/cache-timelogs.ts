import { apolloClient, gql } from "./apollo-client";
import { CACHE_TTL_MS, groupCaches, getOrCreateGroupCache, getCacheKey, usersStore, issuesStore, timelogsStore, registerTimelog, cleanupOrphanedEntities } from "./cache-core";
import { GITLAB_GROUP_PATH, PROJECT_START_DATE, PROJECT_END_DATE } from "./env";

type TimelogNode = {
  id: string;
  spentAt: string;
  timeSpent: number;
  user: any;
  issue: any;
};

const TIMELOGS_QUERY = gql`
  query GetGroupTimelogs($fullPath: ID!, $after: String, $startDate: Time!, $endDate: Time!) {
    group(fullPath: $fullPath) {
      timelogs(startDate: $startDate, endDate: $endDate, first: 100, after: $after) {
        nodes {
          id
          spentAt
          timeSpent
          user {
            username
            name
            webUrl
            bot
            avatarUrl
          }
          issue {
            webUrl
            state
            timeEstimate
            title
            createdAt
            closedAt
            labels {
              nodes {
                title
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

async function fetchAndProcessTimelogs(
  fullGroupPath: string,
  token?: string,
): Promise<string[]> {
  let cursor: string | null = null;
  const timelogIds: string[] = [];

  while (true) {
    const data: any = (await apolloClient.query<any>({
      query: TIMELOGS_QUERY,
      variables: {
        fullPath: fullGroupPath,
        after: cursor,
        startDate: PROJECT_START_DATE,
        endDate: PROJECT_END_DATE,
      },
      fetchPolicy: "no-cache",
    })).data;

    if (!data?.group) {
      throw new Error(`Group not found or inaccessible: ${fullGroupPath}`);
    }
    const nodes: TimelogNode[] = data.group.timelogs?.nodes || [];

    for (const node of nodes) {
      if (node.issue?.webUrl?.includes("deletion_scheduled")) {
        continue;
      }
      const logId = registerTimelog(node);
      timelogIds.push(logId);
    }

    const pageInfo = data.group.timelogs?.pageInfo;
    if (pageInfo?.hasNextPage) {
      cursor = pageInfo.endCursor;
    } else {
      break;
    }
  }

  return timelogIds;
}

export async function getTimelogs(groupId: string, token?: string) {
  const fullGroupPath = `${GITLAB_GROUP_PATH}/${groupId}`;
  const now = Date.now();
  const cacheKey = getCacheKey(fullGroupPath, token);
  const groupCache = getOrCreateGroupCache(cacheKey);
  const isStale = now - groupCache.timelogsTimestamp >= CACHE_TTL_MS;

  if (isStale && !groupCache.timelogsPromise) {
    console.log(
      "[timelogs] MISS — fetching fresh",
      JSON.stringify({ groupId, isStale, ts: groupCache.timelogsTimestamp, cached: !!groupCache.timelogIds, cacheSize: groupCaches.size })
    );
    groupCache.timelogsPromise = fetchAndProcessTimelogs(fullGroupPath, token)
      .then((ids) => {
        const cacheEntry = groupCaches.get(cacheKey)!;
        cacheEntry.timelogIds = ids;
        cacheEntry.timelogsTimestamp = Date.now();
        cacheEntry.timelogsPromise = null;
        cleanupOrphanedEntities();
        return ids;
      })
      .catch((error) => {
        console.error("Failed to refresh timelogs cache:", error);
        const cacheEntry = groupCaches.get(cacheKey)!;
        cacheEntry.timelogsPromise = null;
        throw error;
      });
  }

  const resolveTimelogs = (ids: string[]) => {
    return ids
      .map((id) => {
        const log = timelogsStore.get(id);
        if (!log) return null;
        const user = usersStore.get(log.username);
        const issue = issuesStore.get(log.issueUrl);
        return {
          id: log.id,
          issueUrl: log.issueUrl,
          issueLabels: issue?.labels || [],
          issueTitle: issue?.title || "",
          issueState: issue?.state || "",
          issueTimeEstimate: issue?.timeEstimate || 0,
          issueCreatedAt: issue?.createdAt || "",
          issueClosedAt: issue?.closedAt || null,
          spentAt: log.spentAt,
          timeSpent: log.timeSpent,
          username: log.username,
          sprintNumber: log.sprintNumber,
        };
      })
      .filter((x): x is Exclude<typeof x, null> => x !== null);
  };

  if (groupCache.timelogIds) {
    groupCache.timelogsPromise?.catch(() => {});
    return {
      data: resolveTimelogs(groupCache.timelogIds),
      timestamp: groupCache.timelogsTimestamp,
    };
  }

  const ids = await groupCache.timelogsPromise!;
  return {
    data: resolveTimelogs(ids),
    timestamp: groupCaches.get(cacheKey)!.timelogsTimestamp,
  };
}
