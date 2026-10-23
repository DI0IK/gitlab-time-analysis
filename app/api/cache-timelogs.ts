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
            epic {
              id
              title
              webUrl
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

const EPIC_WORK_ITEMS_TIMELOGS_QUERY = gql`
  query GetGroupEpicTimelogs($fullPath: ID!, $after: String) {
    group(fullPath: $fullPath) {
      workItems(types: [EPIC], includeDescendants: true, first: 100, after: $after) {
        nodes {
          id
          title
          state
          createdAt
          closedAt
          webUrl
          widgets {
            type
            ... on WorkItemWidgetLabels {
              labels {
                nodes {
                  title
                }
              }
            }
            ... on WorkItemWidgetTimeTracking {
              timeEstimate
              totalTimeSpent
              timelogs {
                nodes {
                  id
                  timeSpent
                  spentAt
                  summary
                  user {
                    username
                    name
                    webUrl
                    avatarUrl
                    bot
                  }
                }
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
  const seenIds = new Set<string>();

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
      if (!seenIds.has(logId)) {
        seenIds.add(logId);
        timelogIds.push(logId);
      }
    }

    const pageInfo = data.group.timelogs?.pageInfo;
    if (pageInfo?.hasNextPage) {
      cursor = pageInfo.endCursor;
    } else {
      break;
    }
  }

  // Also fetch direct timelogs on Epics (managed via Work Items in GitLab)
  let epicCursor: string | null = null;
  while (true) {
    let epicData: any = null;
    try {
      epicData = (await apolloClient.query<any>({
        query: EPIC_WORK_ITEMS_TIMELOGS_QUERY,
        variables: {
          fullPath: fullGroupPath,
          after: epicCursor,
        },
        fetchPolicy: "no-cache",
      })).data;
    } catch (err) {
      console.warn("Could not fetch epic work item timelogs for", fullGroupPath, err);
      break;
    }

    if (!epicData?.group) break;
    const workItems = epicData.group.workItems?.nodes || [];

    for (const epicItem of workItems) {
      if (epicItem.webUrl?.includes("deletion_scheduled")) continue;

      const labelsWidget = epicItem.widgets?.find((w: any) => w.type === "LABELS");
      const labels = labelsWidget?.labels || { nodes: [] };
      const timeTrackingWidget = epicItem.widgets?.find(
        (w: any) => w.type === "TIME_TRACKING"
      );
      const timeEstimate = timeTrackingWidget?.timeEstimate || 0;

      const issueObj = {
        webUrl: epicItem.webUrl,
        title: epicItem.title || "",
        state: epicItem.state ? epicItem.state.toLowerCase() : "opened",
        timeEstimate,
        createdAt: epicItem.createdAt || "",
        closedAt: epicItem.closedAt || null,
        labels,
        epic: {
          id: epicItem.id,
          title: epicItem.title || "",
          webUrl: epicItem.webUrl,
        },
      };

      const timelogsNodes = timeTrackingWidget?.timelogs?.nodes || [];
      for (const log of timelogsNodes) {
        if (!log.id || seenIds.has(log.id)) continue;

        if (PROJECT_START_DATE && new Date(log.spentAt) < new Date(PROJECT_START_DATE)) continue;
        if (PROJECT_END_DATE && new Date(log.spentAt) > new Date(PROJECT_END_DATE)) continue;

        const logId = registerTimelog({
          id: log.id,
          spentAt: log.spentAt,
          timeSpent: log.timeSpent,
          user: log.user,
          issue: issueObj,
        });

        seenIds.add(logId);
        timelogIds.push(logId);
      }
    }

    const pageInfo = epicData.group.workItems?.pageInfo;
    if (pageInfo?.hasNextPage) {
      epicCursor = pageInfo.endCursor;
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
          issueEpic: issue?.epic || null,
          issueEpicTitle: issue?.epic?.title || null,
          issueEpicUrl: issue?.epic?.webUrl || null,
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
