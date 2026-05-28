import { GITLAB_DOMAIN, GITLAB_GROUP_PATH } from "./env";
import { runGitlabGraphQLQuery } from "./gitlab";

export type DescendantGroup = {
  fullPath: string;
  name: string;
  id: string;
  url: string;
};

type CacheEntry = {
  data: DescendantGroup[] | null;
  timestamp: number;
  fetchPromise: Promise<DescendantGroup[]> | null;
};

const cache: { [key: string]: CacheEntry } = {};
const CACHE_TTL_MS = 3 * 60 * 1000;
const CACHE_KEY = "descendantGroups";

async function fetchAndProcess(): Promise<DescendantGroup[]> {
  const data = await runGitlabGraphQLQuery(`
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
  `);

  return data.data.group.descendantGroups.nodes.map(
    (group: { fullPath: string; name: string }) => {
      const id = group.fullPath.replace(GITLAB_GROUP_PATH + "/", "");
      const domain = GITLAB_DOMAIN || "https://gitlab.com";
      return {
        fullPath: group.fullPath,
        name: group.name,
        id,
        url: `${domain}/${group.fullPath}`,
      };
    },
  );
}

export async function getDescendantGroups(): Promise<{
  data: DescendantGroup[];
  timestamp: number;
}> {
  const now = Date.now();

  if (!cache[CACHE_KEY]) {
    cache[CACHE_KEY] = { data: null, timestamp: 0, fetchPromise: null };
  }

  const cached = cache[CACHE_KEY];
  const isStale = now - cached.timestamp >= CACHE_TTL_MS;

  if (isStale && !cached.fetchPromise) {
    cached.fetchPromise = fetchAndProcess()
      .then((freshData) => {
        cache[CACHE_KEY] = {
          data: freshData,
          timestamp: Date.now(),
          fetchPromise: null,
        };
        return freshData;
      })
      .catch((error) => {
        console.error("Failed to refresh descendant groups cache:", error);
        cache[CACHE_KEY].fetchPromise = null;
        throw error;
      });
  }

  if (cached.data) {
    cached.fetchPromise?.catch(() => {});
    return { data: cached.data, timestamp: cached.timestamp };
  }

  return await cached.fetchPromise!.then(() => ({
    data: cache[CACHE_KEY].data!,
    timestamp: cache[CACHE_KEY].timestamp,
  }));
}
