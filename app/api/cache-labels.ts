import { apolloClient, gql } from "./apollo-client";
import { CACHE_TTL_MS, groupCaches, getOrCreateGroupCache, getCacheKey, cleanupOrphanedEntities } from "./cache-core";
import { GITLAB_GROUP_PATH } from "./env";

async function fetchAndProcessLabels(
  fullGroupPath: string,
  token?: string,
): Promise<any> {
  const data: any = (await apolloClient.query<any>({
    query: gql`
      query GetGroupLabels($fullPath: ID!) {
        group(fullPath: $fullPath) {
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
    variables: { fullPath: fullGroupPath },
    fetchPolicy: "no-cache",
  })).data;

  if (!data?.group) {
    throw new Error(`Group not found or inaccessible: ${fullGroupPath}`);
  }
  const nodes = data.group.labels?.nodes || [];
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
  const groupCache = getOrCreateGroupCache(cacheKey);
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
