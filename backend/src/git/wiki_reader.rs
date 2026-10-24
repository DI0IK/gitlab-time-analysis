use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::process::Command;
use utoipa::ToSchema;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WikiPageItem {
    pub slug: String,
    pub title: String,
    pub path: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WikiPageContent {
    pub slug: String,
    pub title: String,
    pub path: String,
    pub content: String,
    pub last_commit_id: Option<String>,
    pub last_commit_date: Option<String>,
    pub last_author_name: Option<String>,
}

pub async fn list_local_wiki_pages(
    git_dir: &Path,
    ref_name: Option<&str>,
) -> Result<Vec<WikiPageItem>, AppError> {
    let git_ref = ref_name.unwrap_or("HEAD");
    let output = Command::new("git")
        .arg(format!("--git-dir={}", git_dir.display()))
        .arg("ls-tree")
        .arg("-r")
        .arg("-l")
        .arg(git_ref)
        .output()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to list wiki files: {e}")))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut pages = Vec::new();

    for line in text.lines() {
        let tab_parts: Vec<&str> = line.split('\t').collect();
        if tab_parts.len() < 2 {
            continue;
        }

        let path = tab_parts[1].trim();
        if path.starts_with('.') || path == "_sidebar.md" || path == "_footer.md" {
            continue;
        }

        let lower = path.to_lowercase();
        if !lower.ends_with(".md") && !lower.ends_with(".markdown") {
            continue;
        }

        let slug = if let Some(stripped) = path.strip_suffix(".md") {
            stripped
        } else if let Some(stripped) = path.strip_suffix(".markdown") {
            stripped
        } else {
            path
        };

        let title = slug
            .split('/')
            .next_back()
            .unwrap_or(slug)
            .replace(['-', '_'], " ");

        pages.push(WikiPageItem {
            slug: slug.to_string(),
            title,
            path: path.to_string(),
            format: "markdown".to_string(),
        });
    }

    pages.sort_by(|a, b| {
        let a_is_home = a.slug.eq_ignore_ascii_case("home");
        let b_is_home = b.slug.eq_ignore_ascii_case("home");
        if a_is_home && !b_is_home {
            std::cmp::Ordering::Less
        } else if !a_is_home && b_is_home {
            std::cmp::Ordering::Greater
        } else {
            a.slug.cmp(&b.slug)
        }
    });

    Ok(pages)
}

pub async fn get_local_wiki_page(
    git_dir: &Path,
    slug: &str,
    ref_name: Option<&str>,
) -> Result<WikiPageContent, AppError> {
    let clean_slug = slug.trim_matches('/');
    let candidates = [
        format!("{clean_slug}.md"),
        format!("{clean_slug}.markdown"),
        clean_slug.to_string(),
    ];

    let git_ref = ref_name.unwrap_or("HEAD");
    let mut found_path = None;
    let mut raw_bytes = None;

    for candidate in &candidates {
        let target = format!("{git_ref}:{candidate}");
        let output = Command::new("git")
            .arg(format!("--git-dir={}", git_dir.display()))
            .arg("cat-file")
            .arg("-p")
            .arg(&target)
            .output()
            .await;

        if let Ok(o) = output
            && o.status.success()
        {
            found_path = Some(candidate.clone());
            raw_bytes = Some(o.stdout);
            break;
        }
    }

    let (path, bytes) = match (found_path, raw_bytes) {
        (Some(p), Some(b)) => (p, b),
        _ => return Err(AppError::NotFound(format!("Wiki page '{slug}' not found"))),
    };

    let content = String::from_utf8_lossy(&bytes).to_string();

    let title = content
        .lines()
        .find(|l| l.starts_with("# "))
        .map(|l| l.trim_start_matches("# ").trim().to_string())
        .unwrap_or_else(|| {
            clean_slug
                .split('/')
                .next_back()
                .unwrap_or(clean_slug)
                .replace(['-', '_'], " ")
        });

    let log_output = Command::new("git")
        .arg(format!("--git-dir={}", git_dir.display()))
        .arg("log")
        .arg("-n")
        .arg("1")
        .arg("--format=%H%x00%an%x00%cI")
        .arg(git_ref)
        .arg("--")
        .arg(&path)
        .output()
        .await
        .ok();

    let mut last_commit_id = None;
    let mut last_author_name = None;
    let mut last_commit_date = None;

    if let Some(lo) = log_output
        && lo.status.success()
    {
        let meta = String::from_utf8_lossy(&lo.stdout);
        let meta_parts: Vec<&str> = meta.trim().split('\0').collect();
        if meta_parts.len() >= 3 {
            last_commit_id = Some(meta_parts[0].to_string());
            last_author_name = Some(meta_parts[1].to_string());
            last_commit_date = Some(meta_parts[2].to_string());
        }
    }

    Ok(WikiPageContent {
        slug: clean_slug.to_string(),
        title,
        path,
        content,
        last_commit_id,
        last_commit_date,
        last_author_name,
    })
}
