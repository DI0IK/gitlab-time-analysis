use std::path::{Path, PathBuf};
use tokio::process::Command;
use tracing::{debug, info, warn};

use crate::error::AppError;

pub fn encode_repo_key(project_or_group_path: &str, is_wiki: bool) -> String {
    let clean = project_or_group_path.trim_matches('/').replace('/', "__");
    if is_wiki {
        format!("{clean}.wiki.git")
    } else {
        format!("{clean}.git")
    }
}

pub fn get_repo_dir(base_repos_dir: &str, project_or_group_path: &str, is_wiki: bool) -> PathBuf {
    let key = encode_repo_key(project_or_group_path, is_wiki);
    Path::new(base_repos_dir).join(key)
}

pub fn build_remote_url(
    gitlab_domain: &str,
    project_or_group_path: &str,
    is_wiki: bool,
    token: Option<&str>,
) -> String {
    let domain = gitlab_domain
        .trim_end_matches('/')
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let path = project_or_group_path.trim_matches('/');
    let suffix = if is_wiki { ".wiki.git" } else { ".git" };

    if let Some(t) = token
        && !t.is_empty()
    {
        return format!("https://oauth2:{t}@{domain}/{path}{suffix}");
    }
    format!("https://{domain}/{path}{suffix}")
}

pub async fn sync_bare_repo(
    base_repos_dir: &str,
    gitlab_domain: &str,
    project_or_group_path: &str,
    token: Option<&str>,
    is_wiki: bool,
) -> Result<PathBuf, AppError> {
    let git_dir = get_repo_dir(base_repos_dir, project_or_group_path, is_wiki);
    tokio::fs::create_dir_all(base_repos_dir)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to create repos directory: {e}")))?;

    let url = build_remote_url(gitlab_domain, project_or_group_path, is_wiki, token);
    let is_initialized = git_dir.join("HEAD").exists();

    let start = std::time::Instant::now();

    if !is_initialized {
        debug!(
            "Cloning bare repository: {} -> {:?}",
            project_or_group_path, git_dir
        );

        let output = Command::new("git")
            .env("GIT_TERMINAL_PROMPT", "0")
            .arg("clone")
            .arg("--bare")
            .arg(&url)
            .arg(&git_dir)
            .output()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to spawn git clone: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Some projects or groups simply don't have a wiki initialized yet
            if is_wiki
                && (stderr.contains("not found")
                    || stderr.contains("empty repository")
                    || stderr.contains("403")
                    || stderr.contains("404")
                    || stderr.contains("not allowed"))
            {
                debug!(
                    "Wiki repository for {} not initialized or disabled on GitLab: {}",
                    project_or_group_path, stderr
                );
                return Err(AppError::NotFound(format!(
                    "Wiki for {project_or_group_path} not found or disabled"
                )));
            }
            warn!(
                "git clone --bare failed for {}: {}",
                project_or_group_path, stderr
            );
            return Err(AppError::Internal(format!(
                "git clone --bare failed: {stderr}"
            )));
        }

        info!(
            "Bare mirror cloned in {:?} for {}{}",
            start.elapsed(),
            project_or_group_path,
            if is_wiki { " (wiki)" } else { "" }
        );
    } else {
        debug!("Updating bare repository: {:?}", git_dir);

        let output = Command::new("git")
            .env("GIT_TERMINAL_PROMPT", "0")
            .arg(format!("--git-dir={}", git_dir.display()))
            .arg("fetch")
            .arg("--prune")
            .arg(&url)
            .arg("+refs/heads/*:refs/heads/*")
            .arg("+refs/tags/*:refs/tags/*")
            .output()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to spawn git fetch: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            warn!("git fetch failed for {}: {}", project_or_group_path, stderr);
            return Err(AppError::Internal(format!("git fetch failed: {stderr}")));
        }

        debug!(
            "Bare mirror updated in {:?} for {}{}",
            start.elapsed(),
            project_or_group_path,
            if is_wiki { " (wiki)" } else { "" }
        );
    }

    Ok(git_dir)
}
