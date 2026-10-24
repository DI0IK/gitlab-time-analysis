use axum::http::{HeaderMap, header};

pub mod crypto;

pub const SESSION_COOKIE_NAME: &str = "gta_session";
pub const OAUTH_STATE_COOKIE_NAME: &str = "gta_oauth_state";
pub const OAUTH_VERIFIER_COOKIE_NAME: &str = "gta_oauth_verifier";

pub fn build_cookie(name: &str, value: &str, max_age_secs: i64, is_secure: bool) -> String {
    let mut cookie =
        format!("{name}={value}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age_secs}");
    if is_secure {
        cookie.push_str("; Secure");
    }
    cookie
}

pub fn build_delete_cookie(name: &str) -> String {
    format!(
        "{name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    )
}

pub fn extract_cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let cookie_header = headers.get("cookie")?.to_str().ok()?;
    for pair in cookie_header.split(';') {
        let mut parts = pair.trim().splitn(2, '=');
        if let (Some(k), Some(v)) = (parts.next(), parts.next())
            && k == name
        {
            return Some(v.to_string());
        }
    }
    None
}

pub fn append_cookie(headers: &mut HeaderMap, cookie_str: &str) {
    if let Ok(val) = cookie_str.parse() {
        headers.append(header::SET_COOKIE, val);
    }
}
