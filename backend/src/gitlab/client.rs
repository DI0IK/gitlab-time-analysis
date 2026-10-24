use reqwest::{Client, StatusCode, header};
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::{
    error::AppError,
    gitlab::graphql::{GraphQLRequest, GraphQLResponse},
};

#[derive(Clone)]
pub struct GitLabClient {
    http: Client,
    domain: String,
    token: Option<String>,
}

impl GitLabClient {
    pub fn new(http: Client, domain: String, token: Option<String>) -> Self {
        Self {
            http,
            domain: domain.trim_end_matches('/').to_string(),
            token,
        }
    }

    pub fn with_token(&self, token: String) -> Self {
        Self {
            http: self.http.clone(),
            domain: self.domain.clone(),
            token: Some(token),
        }
    }

    pub async fn query_graphql<T: DeserializeOwned>(
        &self,
        query: &str,
        variables: Option<Value>,
    ) -> Result<T, AppError> {
        let url = format!("{}/api/graphql", self.domain);
        let body = GraphQLRequest {
            query: query.to_string(),
            variables,
        };

        let mut attempts = 0u64;
        let resp = loop {
            attempts += 1;
            let mut req = self.http.post(&url);
            if let Some(token) = &self.token {
                req = req.header(header::AUTHORIZATION, format!("Bearer {token}"));
            }

            match req.json(&body).send().await {
                Ok(r)
                    if (r.status().is_server_error()
                        || r.status() == StatusCode::TOO_MANY_REQUESTS)
                        && attempts < 3 =>
                {
                    tracing::warn!(
                        "GitLab GraphQL returned HTTP {}, retrying in {}ms (attempt {attempts}/3)...",
                        r.status(),
                        attempts * 500
                    );
                    tokio::time::sleep(tokio::time::Duration::from_millis(attempts * 500)).await;
                }
                Ok(r) => break r,
                Err(e) if attempts < 3 => {
                    tracing::warn!(
                        "GitLab GraphQL network request failed: {e}, retrying in {}ms (attempt {attempts}/3)...",
                        attempts * 500
                    );
                    tokio::time::sleep(tokio::time::Duration::from_millis(attempts * 500)).await;
                }
                Err(e) => {
                    return Err(AppError::Internal(format!(
                        "GitLab GraphQL request failed: {e}"
                    )));
                }
            }
        };

        let status = resp.status();
        if status == StatusCode::UNAUTHORIZED {
            return Err(AppError::Unauthorized(
                "GitLab API authentication failed".to_string(),
            ));
        }
        if status == StatusCode::TOO_MANY_REQUESTS {
            return Err(AppError::Internal(
                "GitLab API rate limit exceeded".to_string(),
            ));
        }
        if !status.is_success() {
            return Err(AppError::Internal(format!(
                "GitLab GraphQL returned HTTP status {status}"
            )));
        }

        let text = resp
            .text()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read GraphQL response: {e}")))?;

        let parsed: GraphQLResponse<T> = serde_json::from_str(&text).map_err(|e| {
            AppError::Internal(format!(
                "Failed to parse GraphQL response: {e} (body snippet: {})",
                text.chars().take(200).collect::<String>()
            ))
        })?;

        if let Some(errors) = parsed.errors
            && !errors.is_empty()
        {
            let msgs: Vec<String> = errors.into_iter().map(|e| e.message).collect();
            return Err(AppError::Internal(format!(
                "GitLab GraphQL errors: {}",
                msgs.join("; ")
            )));
        }

        parsed.data.ok_or_else(|| {
            AppError::Internal("GitLab GraphQL returned empty data payload".to_string())
        })
    }

    pub async fn get_rest<T: DeserializeOwned>(&self, path: &str) -> Result<T, AppError> {
        let clean_path = path.trim_start_matches('/');
        let url = format!("{}/api/v4/{}", self.domain, clean_path);
        let mut attempts = 0u64;
        let resp = loop {
            attempts += 1;
            let mut req = self.http.get(&url);
            if let Some(token) = &self.token {
                req = req.header(header::AUTHORIZATION, format!("Bearer {token}"));
            }

            match req.send().await {
                Ok(r)
                    if (r.status().is_server_error()
                        || r.status() == StatusCode::TOO_MANY_REQUESTS)
                        && attempts < 3 =>
                {
                    tracing::warn!(
                        "GitLab REST returned HTTP {}, retrying in {}ms (attempt {attempts}/3)...",
                        r.status(),
                        attempts * 500
                    );
                    tokio::time::sleep(tokio::time::Duration::from_millis(attempts * 500)).await;
                }
                Ok(r) => break r,
                Err(e) if attempts < 3 => {
                    tracing::warn!(
                        "GitLab REST network request failed: {e}, retrying in {}ms (attempt {attempts}/3)...",
                        attempts * 500
                    );
                    tokio::time::sleep(tokio::time::Duration::from_millis(attempts * 500)).await;
                }
                Err(e) => {
                    return Err(AppError::Internal(format!(
                        "GitLab REST request failed: {e}"
                    )));
                }
            }
        };

        let status = resp.status();
        if status == StatusCode::NOT_FOUND {
            return Err(AppError::NotFound(format!(
                "GitLab resource not found: {path}"
            )));
        }
        if status == StatusCode::UNAUTHORIZED {
            return Err(AppError::Unauthorized(
                "GitLab REST unauthorized".to_string(),
            ));
        }
        if !status.is_success() {
            return Err(AppError::Internal(format!(
                "GitLab REST returned HTTP {status}"
            )));
        }

        resp.json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse GitLab REST response: {e}")))
    }
}
