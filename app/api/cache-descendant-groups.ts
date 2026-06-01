import { apolloClient, gql } from "./apollo-client";
import { CACHE_TTL_MS, descendantGroupsCache, cleanupOrphanedEntities } from "./cache-core";
import type { DescendantGroup } from "./cache-types";
import { GITLAB_DOMAIN, GITLAB_GROUP_PATH } from "./env";

async function fetchAndProcessDescendantGroups(
  token?: string,
): Promise<DescendantGroup[]> {
  const data: any = (await apolloClient.query<any>({
    query: gql`
      query GetDescendantGroups($fullPath: ID!) {
        group(fullPath: $fullPath) {
          descendantGroups {
            nodes {
              fullPath
              name
            }
          }
        }
      }
    `,
    variables: { fullPath: GITLAB_GROUP_PATH },
    fetchPolicy: "no-cache",
  })).data;

  if (!data?.group) {
    throw new Error(
      `Parent group not found or inaccessible: ${GITLAB_GROUP_PATH}`,
    );
  }
  const nodes = data.group.descendantGroups?.nodes || [];
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
