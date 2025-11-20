import { GITLAB_DOMAIN, GITLAB_TOKEN } from "@/app/api/env";

const graphqlCache: {
  [key: string]: {
    data: unknown;
    timestamp: number;
  };
} = {};

export async function runGitlabGraphQLQuery(query: string) {
  if (graphqlCache[query]) {
    const cached = graphqlCache[query];
    const now = Date.now();
    // Cache for 5 minutes
    if (now - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }
  }
  const response = await fetch(
    (GITLAB_DOMAIN || "https://gitlab.com") + "/api/graphql",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GITLAB_TOKEN}`,
      },
      body: JSON.stringify({
        query: query,
      }),
    }
  );
  const data = await response.json();
  graphqlCache[query] = {
    data: data,
    timestamp: Date.now(),
  };
  return data;
}

export async function runGitlabRESTQuery(endpoint: string) {
  const response = await fetch(
    (GITLAB_DOMAIN || "https://gitlab.com") + "/api/v4" + endpoint,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GITLAB_TOKEN}`,
      },
    }
  );
  const data = await response.json();
  return data;
}
