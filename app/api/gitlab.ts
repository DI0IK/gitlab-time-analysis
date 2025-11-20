import { GITLAB_DOMAIN, GITLAB_TOKEN } from "@/app/api/env";

export async function runGitlabGraphQLQuery(query: string) {
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
