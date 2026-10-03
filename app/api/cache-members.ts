import { apolloClient, gql } from "./apollo-client";
import { CACHE_TTL_MS, groupCaches, getOrCreateGroupCache, getCacheKey, usersStore, registerUser, cleanupOrphanedEntities } from "./cache-core";
import { GITLAB_GROUP_PATH } from "./env";
import { getDescendantGroups } from "./cache-descendant-groups";
import type { DescendantGroup } from "./cache-types";

const DIRECT_MEMBERS_QUERY = gql`
  query GetDirectMembers($fullPath: ID!) {
    group(fullPath: $fullPath) {
      groupMembers(accessLevels: [OWNER, MAINTAINER, ADMIN], relations: [DIRECT]) {
        nodes {
          user { username name webUrl bot avatarUrl }
        }
      }
    }
  }
`;

const INHERITED_MEMBERS_QUERY = gql`
  query GetInheritedMembers($fullPath: ID!, $after: String) {
    group(fullPath: $fullPath) {
      groupMembers(first: 100, after: $after, accessLevels: [OWNER, MAINTAINER, ADMIN], relations: [INHERITED]) {
        nodes {
          user { username name webUrl bot avatarUrl }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const TIMELOG_USERS_QUERY = gql`
  query GetTimelogUsers($fullPath: ID!, $after: String) {
    group(fullPath: $fullPath) {
      timelogs(first: 100, after: $after) {
        nodes {
          user { username name webUrl bot avatarUrl }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const ROOT_OWNERS_QUERY = gql`
  query GetRootOwners($fullPath: ID!) {
    group(fullPath: $fullPath) {
      groupMembers(accessLevels: [OWNER], relations: [DIRECT]) {
        nodes {
          user { username }
        }
      }
    }
  }
`;

type MemberUser = { user?: { username: string; name: string; webUrl: string; bot: boolean; avatarUrl: string | null } | null };

let rootOwnersCache: { owners: Set<string>; timestamp: number } | null = null;
async function getRootOwners(): Promise<Set<string>> {
  const now = Date.now();
  if (rootOwnersCache && now - rootOwnersCache.timestamp < CACHE_TTL_MS) {
    return rootOwnersCache.owners;
  }
  try {
    const res: any = await apolloClient.query<any>({
      query: ROOT_OWNERS_QUERY,
      variables: { fullPath: GITLAB_GROUP_PATH },
      fetchPolicy: "no-cache",
    });
    const nodes = res.data?.group?.groupMembers?.nodes || [];
    const set = new Set<string>();
    for (const node of nodes) {
      if (node.user?.username) {
        set.add(node.user.username.toLowerCase());
      }
    }
    rootOwnersCache = { owners: set, timestamp: now };
    return set;
  } catch (err) {
    console.warn("Failed to fetch root group owners:", err);
    return rootOwnersCache?.owners || new Set<string>();
  }
}

async function fetchAndProcessMembers(
  fullGroupPath: string,
  groupId: string,
  token?: string,
): Promise<{ all: string[]; verified: string[] }> {
  const allUsernames = new Set<string>();
  const directTeamUsernames = new Set<string>();
  const inheritedUsernames = new Set<string>();
  const timelogUsernames = new Set<string>();

  // 1. Fetch root group owners (instructors/admins) to prevent them from showing as team members with 0h
  const rootOwnersPromise = getRootOwners();

  // 2. Discover related groups (child exercise subgroups and parent team group)
  let descendantGroups: DescendantGroup[] = [];
  try {
    const res = await getDescendantGroups(token);
    descendantGroups = res.data;
  } catch (e) {
    console.warn("Failed to get descendant groups for member resolution:", e);
  }

  const childSubgroups = descendantGroups.filter(
    (g) => g.parentId === groupId || g.id.startsWith(groupId + "/")
  );
  const currentGroup = descendantGroups.find((g) => g.id === groupId);
  const parentGroup = currentGroup?.parentId
    ? descendantGroups.find((g) => g.id === currentGroup.parentId)
    : null;

  // Paths to query for direct members: target group, its exercises, and its parent
  const directPaths = [fullGroupPath];
  for (const child of childSubgroups) {
    directPaths.push(`${GITLAB_GROUP_PATH}/${child.id}`);
  }
  if (parentGroup) {
    directPaths.push(`${GITLAB_GROUP_PATH}/${parentGroup.id}`);
  }
  const uniqueDirectPaths = Array.from(new Set(directPaths));

  // Fetch primary group, additional direct members, inherited, and timelogs in parallel
  const [rootOwners, primaryDirectResult, additionalDirectResults, inheritedResult, dataInferred] =
    await Promise.all([
      rootOwnersPromise,
      apolloClient.query<any>({
        query: DIRECT_MEMBERS_QUERY,
        variables: { fullPath: fullGroupPath },
        fetchPolicy: "no-cache",
      }),
      Promise.all(
        uniqueDirectPaths
          .filter((p) => p !== fullGroupPath)
          .map(async (path) => {
            try {
              const res: any = await apolloClient.query<any>({
                query: DIRECT_MEMBERS_QUERY,
                variables: { fullPath: path },
                fetchPolicy: "no-cache",
              });
              return (res?.data?.group?.groupMembers?.nodes || []) as MemberUser[];
            } catch (err) {
              console.warn(`Failed to fetch direct members for ${path}:`, err);
              return [];
            }
          })
      ),
      (async (): Promise<MemberUser[]> => {
        const inherited: MemberUser[] = [];
        let cursor: string | null = null;
        while (true) {
          try {
            const result: any = await apolloClient.query<any>({
              query: INHERITED_MEMBERS_QUERY,
              variables: { fullPath: fullGroupPath, after: cursor },
              fetchPolicy: "no-cache",
            });
            const data = result.data;
            const nodes = data?.group?.groupMembers?.nodes || [];
            inherited.push(...nodes);
            const pageInfo = data?.group?.groupMembers?.pageInfo;
            if (pageInfo?.hasNextPage) {
              cursor = pageInfo.endCursor;
            } else {
              break;
            }
          } catch (err) {
            console.warn("Inherited members fetch failed (non-fatal):", err);
            break;
          }
        }
        return inherited;
      })(),
      (async (): Promise<MemberUser[]> => {
        const nodes: MemberUser[] = [];
        let cursor: string | null = null;
        while (true) {
          try {
            const result2: any = await apolloClient.query<any>({
              query: TIMELOG_USERS_QUERY,
              variables: { fullPath: fullGroupPath, after: cursor },
              fetchPolicy: "no-cache",
            });
            const data2 = result2.data;
            nodes.push(...(data2?.group?.timelogs?.nodes || []));
            const pageInfo = data2?.group?.timelogs?.pageInfo;
            if (pageInfo?.hasNextPage) {
              cursor = pageInfo.endCursor;
            } else {
              break;
            }
          } catch (err) {
            console.warn("Inferred members fetch failed (non-fatal):", err);
            break;
          }
        }
        return nodes;
      })(),
    ]);

  if (!primaryDirectResult?.data?.group) {
    throw new Error(`Group not found or inaccessible: ${fullGroupPath}`);
  }

  // Register primary direct members
  if (primaryDirectResult.data.group.groupMembers?.nodes) {
    for (const node of primaryDirectResult.data.group.groupMembers.nodes) {
      if (node.user) {
        const username = registerUser(node.user);
        allUsernames.add(username);
        directTeamUsernames.add(username);
      }
    }
  }

  // Register additional direct members from child subgroups or parent group
  for (const nodes of additionalDirectResults) {
    for (const node of nodes) {
      if (node.user) {
        const username = registerUser(node.user);
        allUsernames.add(username);
        directTeamUsernames.add(username);
      }
    }
  }

  // Register timelog users
  for (const node of dataInferred) {
    if (node.user) {
      const username = registerUser(node.user);
      allUsernames.add(username);
      timelogUsernames.add(username);
    }
  }

  // Register inherited members ONLY if they have logged timelogs in this group
  for (const node of inheritedResult) {
    if (node.user) {
      const username = registerUser(node.user);
      if (timelogUsernames.has(username)) {
        allUsernames.add(username);
        inheritedUsernames.add(username);
      }
    }
  }

  // Determine verified members:
  // - Real students directly assigned to this group, its exercises, or parent team -> verified: true
  // - Anyone who has logged timelogs -> verified: true
  // - Bots -> verified: false
  // - Root course owners without timelogs -> verified: false
  const verified = new Set<string>();
  for (const username of allUsernames) {
    const user = usersStore.get(username);
    const uLower = username.toLowerCase();
    const isBot =
      user?.bot ||
      uLower.startsWith("group_") ||
      uLower.startsWith("project_") ||
      uLower.includes("_bot_");

    if (isBot) continue;

    if (rootOwners.has(uLower)) {
      if (timelogUsernames.has(username)) {
        verified.add(username);
      }
      continue;
    }

    if (directTeamUsernames.has(username) || timelogUsernames.has(username)) {
      verified.add(username);
    }
  }

  return {
    all: Array.from(allUsernames),
    verified: Array.from(verified),
  };
}

export async function getMembers(groupId: string, token?: string) {
  const fullGroupPath = `${GITLAB_GROUP_PATH}/${groupId}`;
  const now = Date.now();
  const cacheKey = getCacheKey(fullGroupPath, token);
  const groupCache = getOrCreateGroupCache(cacheKey);
  const isStale = now - groupCache.membersTimestamp >= CACHE_TTL_MS;

  if (isStale && !groupCache.membersPromise) {
    groupCache.membersPromise = fetchAndProcessMembers(fullGroupPath, groupId, token)
      .then(({ all, verified }) => {
        const cacheEntry = groupCaches.get(cacheKey)!;
        cacheEntry.memberUsernames = all;
        cacheEntry.verifiedMemberUsernames = verified;
        cacheEntry.membersTimestamp = Date.now();
        cacheEntry.membersPromise = null;
        cleanupOrphanedEntities();
        return all;
      })
      .catch((error) => {
        console.error("Failed to refresh members cache:", error);
        const cacheEntry = groupCaches.get(cacheKey)!;
        cacheEntry.membersPromise = null;
        throw error;
      });
  }

  const resolveMembers = (usernames: string[], verifiedSet?: Set<string>) => {
    return usernames
      .map((username) => {
        const user = usersStore.get(username);
        const uLower = username.toLowerCase();
        const isBot =
          user?.bot ||
          uLower.startsWith("group_") ||
          uLower.startsWith("project_") ||
          uLower.includes("_bot_");
        const isVerified = isBot
          ? false
          : verifiedSet
            ? verifiedSet.has(username)
            : true;
        return user
          ? {
              id: user.username,
              name: user.name,
              url: user.webUrl,
              bot: isBot,
              avatarUrl: user.avatarUrl,
              verified: isVerified,
            }
          : null;
      })
      .filter((x): x is Exclude<typeof x, null> => x !== null)
      .sort((a, b) => {
        if (a.verified !== b.verified) {
          return a.verified ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  };

  if (groupCache.memberUsernames) {
    groupCache.membersPromise?.catch(() => {});
    const verifiedSet = groupCache.verifiedMemberUsernames
      ? new Set(groupCache.verifiedMemberUsernames)
      : undefined;
    return {
      data: resolveMembers(groupCache.memberUsernames, verifiedSet),
      timestamp: groupCache.membersTimestamp,
    };
  }

  const usernames = await groupCache.membersPromise!;
  const cacheEntry = groupCaches.get(cacheKey)!;
  const verifiedSet = cacheEntry.verifiedMemberUsernames
    ? new Set(cacheEntry.verifiedMemberUsernames)
    : undefined;
  return {
    data: resolveMembers(usernames, verifiedSet),
    timestamp: cacheEntry.membersTimestamp,
  };
}
