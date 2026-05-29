import { GITLAB_DOMAIN, GITLAB_TOKEN } from "@/app/api/env";

const DEFAULT_TIMEOUT_MS = 15000; // 15 seconds

export async function runGitlabGraphQLQuery(
  query: string,
  token?: string,
  retries = 3,
  backoffMs = 1000,
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const resolvedDomain = (GITLAB_DOMAIN || "https://gitlab.com").replace(
    /\/$/,
    "",
  );
  // Reads (GraphQL queries) exclusively use the server's API key
  const resolvedToken = GITLAB_TOKEN;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (resolvedToken) {
    headers["Authorization"] = `Bearer ${resolvedToken}`;
  }

  try {
    const response = await fetch(`${resolvedDomain}/api/graphql`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Keep your original HTTP error parsing
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GraphQL Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();

    // Keep your original GraphQL internal error parsing
    if (data.errors && data.errors.length > 0) {
      throw new Error(
        `GraphQL Error: ${data.errors.map((e: any) => e.message).join(", ")}`,
      );
    }

    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);

    const isAbort = error.name === "AbortError";
    const isNetworkError =
      isAbort ||
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNRESET" ||
      error.cause?.code === "ETIMEDOUT" ||
      error.message?.includes("fetch failed");

    // Trigger Exponential Backoff
    if (isNetworkError && retries > 0) {
      console.warn(
        `[Network] GraphQL fetch failed (${
          isAbort ? "Timeout" : error.code || "Network Error"
        }). Retrying in ${backoffMs}ms... (${retries} attempts left)`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return runGitlabGraphQLQuery(query, token, retries - 1, backoffMs * 2);
    }

    if (isAbort) {
      throw new Error(
        `GraphQL request timed out after ${DEFAULT_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  }
}

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
