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
        .arg("-c")
        .arg("core.quotePath=false")
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

        let raw_path = tab_parts[1].trim();
        let path = raw_path
            .strip_prefix('"')
            .and_then(|p| p.strip_suffix('"'))
            .unwrap_or(raw_path);

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
    let mut candidates = vec![
        format!("{clean_slug}.md"),
        format!("{clean_slug}.markdown"),
        clean_slug.to_string(),
    ];
    let dash_var = clean_slug.replace(' ', "-");
    let space_var = clean_slug.replace('-', " ");
    if dash_var != clean_slug {
        candidates.push(format!("{dash_var}.md"));
        candidates.push(format!("{dash_var}.markdown"));
        candidates.push(dash_var);
    }
    if space_var != clean_slug {
        candidates.push(format!("{space_var}.md"));
        candidates.push(format!("{space_var}.markdown"));
        candidates.push(space_var);
    }

    let git_ref = ref_name.unwrap_or("HEAD");
    let mut found_path = None;
    let mut raw_bytes = None;

    for candidate in &candidates {
        let target = format!("{git_ref}:{candidate}");
        let output = Command::new("git")
            .arg("-c")
            .arg("core.quotePath=false")
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
        .arg("-c")
        .arg("core.quotePath=false")
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[tokio::test]
    async fn test_emoji_wiki_pages() {
        let tmp = std::env::temp_dir().join(format!("wiki-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&tmp).expect("create test dir");

        let run_git = |args: &[&str]| {
            let mut cmd = std::process::Command::new("git");
            cmd.current_dir(&tmp);
            cmd.args(args);
            let res = cmd.output().expect("run git command");
            assert!(
                res.status.success(),
                "git {:?} failed: {:?}",
                args,
                String::from_utf8_lossy(&res.stderr)
            );
        };

        run_git(&["init"]);
        run_git(&["config", "user.email", "test@example.com"]);
        run_git(&["config", "user.name", "Test User"]);
        run_git(&["config", "commit.gpgsign", "false"]);

        fs::write(tmp.join("home.md"), "# Welcome Home\n\nWiki home page.").expect("write home.md");
        fs::write(
            tmp.join("🚀-Roadmap.md"),
            "# Product Roadmap\n\nMilestones and goals.",
        )
        .expect("write emoji file 1");
        fs::write(tmp.join("01-📋-Tasks.md"), "# Task List\n\nAction items.")
            .expect("write emoji file 2");

        let docs_dir = tmp.join("docs");
        fs::create_dir_all(&docs_dir).expect("create docs dir");
        fs::write(
            docs_dir.join("🎉-Release.md"),
            "# Release Notes\n\nV1 launch.",
        )
        .expect("write emoji file 3");

        run_git(&["add", "."]);
        run_git(&["commit", "-m", "initial wiki commit"]);

        // 1. Test listing
        let pages = list_local_wiki_pages(&tmp.join(".git"), None)
            .await
            .expect("list pages");
        assert_eq!(
            pages.len(),
            4,
            "Expected 4 pages including emoji files, got: {:?}",
            pages
        );

        let slugs: Vec<&str> = pages.iter().map(|p| p.slug.as_str()).collect();
        assert_eq!(slugs[0], "home", "Home page should be first");
        assert!(slugs.contains(&"🚀-Roadmap"), "Should contain 🚀-Roadmap");
        assert!(slugs.contains(&"01-📋-Tasks"), "Should contain 01-📋-Tasks");
        assert!(
            slugs.contains(&"docs/🎉-Release"),
            "Should contain docs/🎉-Release"
        );

        // 2. Test reading emoji page
        let page = get_local_wiki_page(&tmp.join(".git"), "🚀-Roadmap", None)
            .await
            .expect("get emoji page");
        assert_eq!(page.title, "Product Roadmap");
        assert!(page.content.contains("Milestones and goals"));

        // 3. Test reading with space-dash variation
        let page_space = get_local_wiki_page(&tmp.join(".git"), "🚀 Roadmap", None)
            .await
            .expect("get emoji page with space");
        assert_eq!(page_space.title, "Product Roadmap");

        // Cleanup
        let _ = fs::remove_dir_all(&tmp);
    }
}
