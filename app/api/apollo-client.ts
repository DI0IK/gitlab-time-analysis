import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, from, gql, CombinedGraphQLErrors } from "@apollo/client";
import { RetryLink } from "@apollo/client/link/retry";
import { onError } from "@apollo/client/link/error";
import { GITLAB_DOMAIN, GITLAB_TOKEN } from "./env";

const DEFAULT_TIMEOUT_MS = 60000;

// Wrap native fetch with an AbortController timeout — Apollo's HttpLink has none.
const timeoutFetch: typeof fetch = (url, options) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
};

const httpLink = new HttpLink({
  uri: `${(GITLAB_DOMAIN || "https://gitlab.com").replace(/\/$/, "")}/api/graphql`,
  fetch: timeoutFetch,
});

// Attach auth header from server token
const authLink = new ApolloLink((operation, forward) => {
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      Authorization: `Bearer ${GITLAB_TOKEN}`,
      "Content-Type": "application/json",
    },
  }));
  return forward(operation);
});

const retryLink = new RetryLink({
  delay: { initial: 1000, max: 10000, jitter: true },
  attempts: { max: 3 },
});

const errorLink = onError(({ error }) => {
  if (CombinedGraphQLErrors.is(error)) {
    for (const err of error.errors) {
      console.error(`[Apollo] GraphQL error: ${err.message}`);
    }
  } else {
    console.error(`[Apollo] Network error: ${error.message}`);
  }
});

export const apolloClient = new ApolloClient({
  link: from([retryLink, errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
});

export { gql };
