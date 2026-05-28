import {
  GITLAB_DOMAIN,
  GITLAB_GROUP_PATH,
  PROJECT_START_DATE,
  PROJECT_END_DATE,
  SPRINT_DURATION_WEEKS,
  SPRINT_START_WEEKDAY,
} from "./env";
import { runGitlabGraphQLQuery } from "./gitlab";

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export interface NormalizedUser {
  username: string;
  name: string;
  webUrl: string;
  bot: boolean;
  avatarUrl: string | null;
}

export interface NormalizedIssue {
  webUrl: string;
  title: string;
  state: string;
  timeEstimate: number;
  labels: string[];
  createdAt: string;
}

export interface NormalizedTimelog {
  id: string;
  spentAt: string;
  timeSpent: number;
  username: string; // references usersStore
  issueUrl: string; // references issuesStore
  sprintNumber?: number;
}

// Global registry maps
const usersStore = new Map<string, NormalizedUser>();
const issuesStore = new Map<string, NormalizedIssue>();
const timelogsStore = new Map<string, NormalizedTimelog>();

// Group lists maps
interface GroupCacheEntry {
  memberUsernames: string[] | null;
  membersTimestamp: number;
  membersPromise: Promise<string[]> | null;

  timelogIds: string[] | null;
  timelogsTimestamp: number;
  timelogsPromise: Promise<string[]> | null;

  labels: any | null;
  labelsTimestamp: number;
  labelsPromise: Promise<any> | null;
}

const groupCaches = new Map<string, GroupCacheEntry>();

// Cache key helper
function getCacheKey(fullGroupPath: string, token?: string): string {
  if (!token) return fullGroupPath;
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash << 5) - hash + token.charCodeAt(i);
    hash |= 0;
  }
  return `${fullGroupPath}:${hash}`;
}

// Avatar normalizer
function normalizeAvatarUrl(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }
  if (avatarUrl.startsWith("/")) {
    const domain = GITLAB_DOMAIN || "https://gitlab.com";
    return `${domain}${avatarUrl}`;
  }
  return avatarUrl;
}

// Registration helpers
function registerUser(userNode: any): string {
  const username = userNode.username;
  const normalized: NormalizedUser = {
    username,
    name: userNode.name || "",
    webUrl: userNode.webUrl || "",
    bot: !!userNode.bot,
    avatarUrl: normalizeAvatarUrl(userNode.avatarUrl || null),
  };
  usersStore.set(username, normalized);
  return username;
}

function registerIssue(issueNode: any): string {
  const webUrl = issueNode.webUrl;
  const labels = (issueNode.labels?.nodes || []).map((label: any) => {
    const title = label.title;
    return title.includes("::")
      ? title
      : title.includes(":")
        ? title.replace(/:/g, "::")
        : "Ungrouped::" + title;
  });

  const normalized: NormalizedIssue = {
    webUrl,
    title: issueNode.title || "",
    state: issueNode.state || "",
    timeEstimate: issueNode.timeEstimate || 0,
    labels,
    createdAt: issueNode.createdAt || new Date().toISOString(),
  };
  issuesStore.set(webUrl, normalized);
  return webUrl;
}

// registration helper
function registerTimelog(logNode: any): string {
  const id = logNode.id;
  const username = logNode.user ? registerUser(logNode.user) : "unknown";
  const issueUrl = logNode.issue ? registerIssue(logNode.issue) : "";

  // Calculate sprint number
  const spentDate = new Date(logNode.spentAt);
  const projectStartDate = new Date(PROJECT_START_DATE || "");

  const parseDesiredWeekday = (fallbackWeekday: number) => {
    const w = (SPRINT_START_WEEKDAY || "").trim().toLowerCase();
    if (w === "") return fallbackWeekday;
    if (/^\d+$/.test(w)) return parseInt(w, 10) % 7;
    const map: Record<string, number> = {
      sunday: 0,
      sun: 0,
      monday: 1,
      mon: 1,
      tuesday: 2,
      tue: 2,
      wednesday: 3,
      wed: 3,
      thursday: 4,
      thu: 4,
      friday: 5,
      fri: 5,
      saturday: 6,
      sat: 6,
    };
    return map[w] ?? fallbackWeekday;
  };

  let sprintNumber: number | undefined = undefined;
  if (!isNaN(projectStartDate.getTime()) && !isNaN(spentDate.getTime())) {
    const desiredWeekday = parseDesiredWeekday(projectStartDate.getDay());
    const projectStartDay = projectStartDate.getDay();
    const offsetDays = (desiredWeekday - projectStartDay + 7) % 7;
    const firstSprintStart = new Date(projectStartDate);
    firstSprintStart.setDate(projectStartDate.getDate() + offsetDays);

    const utc = (d: Date) =>
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysDifference = Math.floor(
      (utc(spentDate) - utc(firstSprintStart)) / msPerDay,
    );
    const sprintDurationDays = parseInt(SPRINT_DURATION_WEEKS || "1", 10) * 7;
    const calcSprint = Math.floor(daysDifference / sprintDurationDays) + 1;
    sprintNumber = calcSprint > 0 ? calcSprint : undefined;
  }

  const normalized: NormalizedTimelog = {
    id,
    spentAt: logNode.spentAt,
    timeSpent: logNode.timeSpent,
    username,
    issueUrl,
    sprintNumber,
  };
  timelogsStore.set(id, normalized);
  return id;
}

// Active caches garbage collection
function cleanupOrphanedEntities() {
  // Abort immediately if any network promises are in progress to prevent deleting mid-fetch entities
  const hasActivePromises =
    Array.from(groupCaches.values()).some(
      (c) => c.membersPromise || c.timelogsPromise || c.labelsPromise,
    ) || Array.from(descendantGroupsCache.values()).some((c) => c.fetchPromise);

  if (hasActivePromises) {
    return;
  }

  const activeUsernames = new Set<string>();
  const activeIssueUrls = new Set<string>();
  const activeTimelogIds = new Set<string>();

  for (const cacheEntry of groupCaches.values()) {
    if (cacheEntry.memberUsernames) {
      for (const username of cacheEntry.memberUsernames) {
        activeUsernames.add(username);
      }
    }
    if (cacheEntry.timelogIds) {
      for (const id of cacheEntry.timelogIds) {
        activeTimelogIds.add(id);
        const log = timelogsStore.get(id);
        if (log) {
          activeUsernames.add(log.username);
          activeIssueUrls.add(log.issueUrl);
        }
      }
    }
  }

  for (const username of usersStore.keys()) {
    if (!activeUsernames.has(username)) {
      usersStore.delete(username);
    }
  }

  for (const url of issuesStore.keys()) {
    if (!activeIssueUrls.has(url)) {
      issuesStore.delete(url);
    }
  }

  for (const id of timelogsStore.keys()) {
    if (!activeTimelogIds.has(id)) {
      timelogsStore.delete(id);
    }
  }
}

// ----------------------------------------------------
// Public Retrieve Functions
// ----------------------------------------------------

async function fetchAndProcessMembers(
  fullGroupPath: string,
  token?: string,
): Promise<string[]> {
  const usernames = new Set<string>();

  // 1. Fetch Direct Group Members
  const data = await runGitlabGraphQLQuery(
    `
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
  `,
    token,
  );

  if (!data?.data?.group) {
    throw new Error(`Group not found or inaccessible: ${fullGroupPath}`);
  }

  if (data?.data?.group?.groupMembers?.nodes) {
    for (const node of data.data.group.groupMembers.nodes) {
      if (node.user) {
        const username = registerUser(node.user);
        usernames.add(username);
      }
    }
  }

  // 2. Fetch Inferred Members (via Timelogs) - Paginated to prevent timeouts
  let inferredFinished = false;
  let inferredCursor: string | null = null;

  while (!inferredFinished) {
    try {
      const dataInferred = await runGitlabGraphQLQuery(
        `
        {
          group(fullPath: "${fullGroupPath}") {
            timelogs(first: 100${inferredCursor ? `, after: "${inferredCursor}"` : ""}) {
              nodes {
                user {
                  username
                  name
                  webUrl
                  bot
                  avatarUrl
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `,
        token,
      );

      const nodes = dataInferred?.data?.group?.timelogs?.nodes || [];
      for (const node of nodes) {
        if (node.user) {
          const username = registerUser(node.user);
          usernames.add(username);
        }
      }

      const pageInfo = dataInferred?.data?.group?.timelogs?.pageInfo;
      if (pageInfo?.hasNextPage) {
        inferredCursor = pageInfo.endCursor;
      } else {
        inferredFinished = true;
      }
    } catch (err) {
      console.warn("Inferred members fetch failed (non-fatal):", err);
      inferredFinished = true; // Break the loop on error so we don't infinitely retry
    }
  }

  return Array.from(usernames);
}

export async function getMembers(groupId: string, token?: string) {
  const fullGroupPath = `${GITLAB_GROUP_PATH}/${groupId}`;
  const now = Date.now();
  const cacheKey = getCacheKey(fullGroupPath, token);

  let groupCache = groupCaches.get(cacheKey);
  if (!groupCache) {
    groupCache = {
      memberUsernames: null,
      membersTimestamp: 0,
      membersPromise: null,
      timelogIds: null,
      timelogsTimestamp: 0,
      timelogsPromise: null,
      labels: null,
      labelsTimestamp: 0,
      labelsPromise: null,
    };
    groupCaches.set(cacheKey, groupCache);
  }

  const isStale = now - groupCache.membersTimestamp >= CACHE_TTL_MS;

  if (isStale && !groupCache.membersPromise) {
    groupCache.membersPromise = fetchAndProcessMembers(fullGroupPath, token)
      .then((usernames) => {
        const cacheEntry = groupCaches.get(cacheKey)!;
        cacheEntry.memberUsernames = usernames;
        cacheEntry.membersTimestamp = Date.now();
        cacheEntry.membersPromise = null;
        cleanupOrphanedEntities();
        return usernames;
      })
      .catch((error) => {
        console.error("Failed to refresh members cache:", error);
        const cacheEntry = groupCaches.get(cacheKey)!;
        cacheEntry.membersPromise = null;
        throw error;
      });
  }

  const resolveMembers = (usernames: string[]) => {
    return usernames
      .map((username) => {
        const user = usersStore.get(username);
        return user
          ? {
              id: user.username,
              name: user.name,
              url: user.webUrl,
              bot: user.bot,
              avatarUrl: user.avatarUrl,
            }
          : null;
      })
      .filter((x): x is Exclude<typeof x, null> => x !== null);
  };

  if (groupCache.memberUsernames) {
    groupCache.membersPromise?.catch(() => {});
    return {
      data: resolveMembers(groupCache.memberUsernames),
      timestamp: groupCache.membersTimestamp,
    };
  }

  const usernames = await groupCache.membersPromise!;
  return {
    data: resolveMembers(usernames),
    timestamp: groupCaches.get(cacheKey)!.membersTimestamp,
  };
}

type TimelogNode = {
  id: string;
  spentAt: string;
  timeSpent: number;
  user: any;
  issue: any;
};

async function fetchAndProcessTimelogs(
  fullGroupPath: string,
  token?: string,
): Promise<string[]> {
  let finished = false;
  let cursor: string | null = null;
  const timelogIds: string[] = [];

  while (!finished) {
    const query = `
      {
        group(fullPath: "${fullGroupPath}") {
          timelogs(startDate: "${PROJECT_START_DATE}", endDate: "${PROJECT_END_DATE}", first: 100${
            cursor ? `, after: "${cursor}"` : ""
          }) {
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

    const response = await runGitlabGraphQLQuery(query, token);
    if (!response?.data?.group) {
      throw new Error(`Group not found or inaccessible: ${fullGroupPath}`);
    }
    const nodes: TimelogNode[] = response.data.group.timelogs?.nodes || [];

    for (const node of nodes) {
      if (node.issue?.webUrl?.includes("deletion_scheduled")) {
        continue;
      }
      const logId = registerTimelog(node);
      timelogIds.push(logId);
    }

    const pageInfo = response?.data?.group?.timelogs?.pageInfo;
    if (pageInfo?.hasNextPage) {
      cursor = pageInfo.endCursor;
    } else {
      finished = true;
    }
  }

  return timelogIds;
}

export async function getTimelogs(groupId: string, token?: string) {
  const fullGroupPath = `${GITLAB_GROUP_PATH}/${groupId}`;
  const now = Date.now();
  const cacheKey = getCacheKey(fullGroupPath, token);

  let groupCache = groupCaches.get(cacheKey);
  if (!groupCache) {
    groupCache = {
      memberUsernames: null,
      membersTimestamp: 0,
      membersPromise: null,
      timelogIds: null,
      timelogsTimestamp: 0,
      timelogsPromise: null,
      labels: null,
      labelsTimestamp: 0,
      labelsPromise: null,
    };
    groupCaches.set(cacheKey, groupCache);
  }

  const isStale = now - groupCache.timelogsTimestamp >= CACHE_TTL_MS;

  if (isStale && !groupCache.timelogsPromise) {
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

async function fetchAndProcessLabels(
  fullGroupPath: string,
  token?: string,
): Promise<any> {
  const data = await runGitlabGraphQLQuery(
    `
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
  `,
    token,
  );

  if (!data?.data?.group) {
    throw new Error(`Group not found or inaccessible: ${fullGroupPath}`);
  }
  const nodes = data.data.group.labels?.nodes || [];
  return nodes.reduce(
    (
      acc: any,
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

export async function getLabels(groupId: string, token?: string) {
  const fullGroupPath = `${GITLAB_GROUP_PATH}/${groupId}`;
  const now = Date.now();
  const cacheKey = getCacheKey(fullGroupPath, token);

  let groupCache = groupCaches.get(cacheKey);
  if (!groupCache) {
    groupCache = {
      memberUsernames: null,
      membersTimestamp: 0,
      membersPromise: null,
      timelogIds: null,
      timelogsTimestamp: 0,
      timelogsPromise: null,
      labels: null,
      labelsTimestamp: 0,
      labelsPromise: null,
    };
    groupCaches.set(cacheKey, groupCache);
  }

  const isStale = now - groupCache.labelsTimestamp >= CACHE_TTL_MS;

  if (isStale && !groupCache.labelsPromise) {
    groupCache.labelsPromise = fetchAndProcessLabels(fullGroupPath, token)
      .then((freshLabels) => {
        const cacheEntry = groupCaches.get(cacheKey)!;
        cacheEntry.labels = freshLabels;
        cacheEntry.labelsTimestamp = Date.now();
        cacheEntry.labelsPromise = null;
        cleanupOrphanedEntities();
        return freshLabels;
      })
      .catch((error) => {
        console.error("Failed to refresh labels cache:", error);
        const cacheEntry = groupCaches.get(cacheKey)!;
        cacheEntry.labelsPromise = null;
        throw error;
      });
  }

  if (groupCache.labels) {
    groupCache.labelsPromise?.catch(() => {});
    return {
      data: groupCache.labels,
      timestamp: groupCache.labelsTimestamp,
    };
  }

  const freshLabels = await groupCache.labelsPromise!;
  return {
    data: freshLabels,
    timestamp: groupCaches.get(cacheKey)!.labelsTimestamp,
  };
}

// ----------------------------------------------------
// Descendant Groups Cache Integration
// ----------------------------------------------------

export type DescendantGroup = {
  fullPath: string;
  name: string;
  id: string;
  url: string;
};

interface DescendantGroupsCacheEntry {
  data: DescendantGroup[] | null;
  timestamp: number;
  fetchPromise: Promise<DescendantGroup[]> | null;
}

const descendantGroupsCache = new Map<string, DescendantGroupsCacheEntry>();

async function fetchAndProcessDescendantGroups(
  token?: string,
): Promise<DescendantGroup[]> {
  const data = await runGitlabGraphQLQuery(
    `
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
  `,
    token,
  );

  if (!data?.data?.group) {
    throw new Error(
      `Parent group not found or inaccessible: ${GITLAB_GROUP_PATH}`,
    );
  }
  const nodes = data.data.group.descendantGroups?.nodes || [];
  return nodes.map((group: { fullPath: string; name: string }) => {
    const id = group.fullPath.replace(GITLAB_GROUP_PATH + "/", "");
    const domain = GITLAB_DOMAIN || "https://gitlab.com";
    return {
      fullPath: group.fullPath,
      name: group.name,
      id,
      url: `${domain}/${group.fullPath}`,
    };
  });
}

function getDescendantCacheKey(token?: string): string {
  const prefix = "descendantGroups";
  if (!token) return prefix;
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash << 5) - hash + token.charCodeAt(i);
    hash |= 0;
  }
  return `${prefix}:${hash}`;
}

export async function getDescendantGroups(token?: string): Promise<{
  data: DescendantGroup[];
  timestamp: number;
}> {
  const now = Date.now();
  const cacheKey = getDescendantCacheKey(token);

  let cacheEntry = descendantGroupsCache.get(cacheKey);
  if (!cacheEntry) {
    cacheEntry = {
      data: null,
      timestamp: 0,
      fetchPromise: null,
    };
    descendantGroupsCache.set(cacheKey, cacheEntry);
  }

  const isStale = now - cacheEntry.timestamp >= CACHE_TTL_MS;

  if (isStale && !cacheEntry.fetchPromise) {
    cacheEntry.fetchPromise = fetchAndProcessDescendantGroups(token)
      .then((freshData) => {
        descendantGroupsCache.set(cacheKey, {
          data: freshData,
          timestamp: Date.now(),
          fetchPromise: null,
        });
        return freshData;
      })
      .catch((error) => {
        console.error("Failed to refresh descendant groups cache:", error);
        const entry = descendantGroupsCache.get(cacheKey)!;
        entry.fetchPromise = null;
        throw error;
      });
  }

  if (cacheEntry.data) {
    cacheEntry.fetchPromise?.catch(() => {});
    return { data: cacheEntry.data, timestamp: cacheEntry.timestamp };
  }

  const freshData = await cacheEntry.fetchPromise!;
  return {
    data: freshData,
    timestamp: descendantGroupsCache.get(cacheKey)!.timestamp,
  };
}

// ----------------------------------------------------
// Diagnostic Helper
// ----------------------------------------------------

export function getCacheStats() {
  return {
    usersCount: usersStore.size,
    issuesCount: issuesStore.size,
    timelogsCount: timelogsStore.size,
    groupCachesCount: groupCaches.size,
    descendantGroupsCachesCount: descendantGroupsCache.size,
  };
}

export function invalidateCache() {
  groupCaches.clear();
  timelogsStore.clear();
  issuesStore.clear();
}
