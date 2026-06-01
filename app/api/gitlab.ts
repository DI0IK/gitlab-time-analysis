import { GITLAB_DOMAIN, GITLAB_TOKEN } from "@/app/api/env";

export async function runGitlabRESTQuery(
  endpoint: string,
  token?: string,
  method: string = "GET",
  body?: any,
  forceUserToken: boolean = false,
) {
  const resolvedDomain = GITLAB_DOMAIN || "https://gitlab.com";
  // Reads (GET requests) exclusively use the server's API key, writes/mutations exclusively use the user's token
  const isRead = method === "GET";
  const resolvedToken = isRead && !forceUserToken ? GITLAB_TOKEN : token;
  const headers: Record<string, string> = {};

  if (resolvedToken) {
    headers["Authorization"] = `Bearer ${resolvedToken}`;
  }

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(resolvedDomain + "/api/v4" + endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch {}
    throw new Error(
      errorJson?.message ||
        errorJson?.error ||
        `HTTP error! status: ${response.status}`,
    );
  }

  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}
