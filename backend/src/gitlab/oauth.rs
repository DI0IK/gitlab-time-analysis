use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::RngCore;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
    pub created_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLabUserResponse {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub web_url: String,
    #[serde(default)]
    pub bot: bool,
}

pub fn generate_pkce() -> (String, String) {
    let mut verifier_bytes = [0u8; 64];
    rand::thread_rng().fill_bytes(&mut verifier_bytes);
    let code_verifier = URL_SAFE_NO_PAD.encode(verifier_bytes);

    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());

    (code_verifier, code_challenge)
}

pub fn build_authorize_url(
    gitlab_domain: &str,
    client_id: &str,
    redirect_uri: &str,
    state: &str,
    code_challenge: &str,
) -> String {
    format!(
        "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&state={}&scope=read_user+read_repository+api&code_challenge={}&code_challenge_method=S256",
        gitlab_domain.trim_end_matches('/'),
        urlencoding::encode(client_id),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(state),
        urlencoding::encode(code_challenge),
    )
}

pub async fn exchange_code(
    client: &Client,
    gitlab_domain: &str,
    client_id: &str,
    client_secret: &str,
    redirect_uri: &str,
    code: &str,
    code_verifier: &str,
) -> Result<OAuthTokenResponse, AppError> {
    let token_url = format!("{}/oauth/token", gitlab_domain.trim_end_matches('/'));

    let params = [
        ("client_id", client_id),
        ("client_secret", client_secret),
        ("code", code),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri),
        ("code_verifier", code_verifier),
    ];

    let resp = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| {
            AppError::GitLab(format!(
                "Failed to connect to GitLab OAuth token endpoint: {e}"
            ))
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::GitLab(format!(
            "OAuth token exchange failed (HTTP {status}): {body}"
        )));
    }

    resp.json::<OAuthTokenResponse>()
        .await
        .map_err(|e| AppError::GitLab(format!("Failed to parse OAuth token response: {e}")))
}

pub async fn fetch_current_user(
    client: &Client,
    gitlab_domain: &str,
    access_token: &str,
) -> Result<GitLabUserResponse, AppError> {
    let user_url = format!("{}/api/v4/user", gitlab_domain.trim_end_matches('/'));

    let resp = client
        .get(&user_url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| AppError::GitLab(format!("Failed to fetch user profile: {e}")))?;

    if !resp.status().is_success() {
        return Err(AppError::Unauthorized(
            "Invalid or expired GitLab access token".to_string(),
        ));
    }

    resp.json::<GitLabUserResponse>()
        .await
        .map_err(|e| AppError::GitLab(format!("Failed to parse user profile: {e}")))
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
    }
}
