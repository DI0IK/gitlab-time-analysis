import { apolloClient, gql } from "./apollo-client";
import { CACHE_TTL_MS, groupCaches, getOrCreateGroupCache, getCacheKey, usersStore, registerUser, cleanupOrphanedEntities } from "./cache-core";
import { GITLAB_GROUP_PATH } from "./env";

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

type MemberUser = { user?: { username: string; name: string; webUrl: string; bot: boolean; avatarUrl: string | null } | null };

async function fetchAndProcessMembers(
  fullGroupPath: string,
  token?: string,
): Promise<{ all: string[]; verified: string[] }> {
  const allUsernames = new Set<string>();
  const directUsernames = new Set<string>();
  const inheritedUsernames = new Set<string>();
  const timelogUsernames = new Set<string>();

  const [directResult, inheritedResult, dataInferred] = await Promise.all([
    apolloClient.query<any>({
      query: DIRECT_MEMBERS_QUERY,
      variables: { fullPath: fullGroupPath },
      fetchPolicy: "no-cache",
    }),
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

  if (!directResult?.data?.group) {
    throw new Error(`Group not found or inaccessible: ${fullGroupPath}`);
  }
  if (directResult.data.group.groupMembers?.nodes) {
    for (const node of directResult.data.group.groupMembers.nodes) {
      if (node.user) {
        const username = registerUser(node.user);
        allUsernames.add(username);
        directUsernames.add(username);
      }
    }
  }

  for (const node of dataInferred) {
    if (node.user) {
      const username = registerUser(node.user);
      allUsernames.add(username);
      timelogUsernames.add(username);
    }
  }

  for (const node of inheritedResult) {
    if (node.user) {
      const username = registerUser(node.user);
      if (timelogUsernames.has(username)) {
        allUsernames.add(username);
        inheritedUsernames.add(username);
      }
    }
  }

  const verified = new Set<string>();
  for (const u of directUsernames) {
    if (timelogUsernames.has(u)) {
      verified.add(u);
    }
  }
  for (const u of inheritedUsernames) {
    verified.add(u);
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
    groupCache.membersPromise = fetchAndProcessMembers(fullGroupPath, token)
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
        return user
          ? {
              id: user.username,
              name: user.name,
              url: user.webUrl,
              bot: user.bot,
              avatarUrl: user.avatarUrl,
              verified: verifiedSet ? verifiedSet.has(username) : true,
            }
          : null;
      })
      .filter((x): x is Exclude<typeof x, null> => x !== null);
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
