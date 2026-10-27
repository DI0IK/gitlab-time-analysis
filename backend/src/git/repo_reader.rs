use std::path::Path;
use tokio::process::Command;

use crate::{
    api::repo::{RepoBranch, RepoBranchCommit, RepoCommit, RepoFileContent, RepoTreeItem},
    error::AppError,
};

pub async fn list_local_branches(git_dir: &Path) -> Result<Vec<RepoBranch>, AppError> {
    // 1. Determine default branch from HEAD
    let head_output = Command::new("git")
        .arg(format!("--git-dir={}", git_dir.display()))
        .arg("symbolic-ref")
        .arg("--short")
        .arg("HEAD")
        .output()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read git HEAD: {e}")))?;

    let default_branch_name = if head_output.status.success() {
        String::from_utf8_lossy(&head_output.stdout)
            .trim()
            .to_string()
    } else {
        "main".to_string()
    };

    // 2. Query all local branch refs
    let output = Command::new("git")
        .arg(format!("--git-dir={}", git_dir.display()))
        .arg("for-each-ref")
        .arg("--format=%(refname:short)%00%(objectname)%00%(objectname:short)%00%(contents:subject)%00%(committerdate:iso8601)")
        .arg("refs/heads/")
        .output()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to list git refs: {e}")))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut branches = Vec::new();

    for line in text.lines() {
        let parts: Vec<&str> = line.split('\0').collect();
        if parts.is_empty() || parts[0].trim().is_empty() {
            continue;
        }

        let name = parts[0].trim().to_string();
        let is_default = name == default_branch_name;
        let commit = if parts.len() >= 4 {
            Some(RepoBranchCommit {
                id: parts.get(1).unwrap_or(&"").to_string(),
                short_id: parts.get(2).unwrap_or(&"").to_string(),
                title: parts.get(3).unwrap_or(&"").to_string(),
                created_at: parts.get(4).map(|s| s.to_string()),
            })
        } else {
            None
        };

        branches.push(RepoBranch {
            name,
            default: is_default,
            protected: false,
            commit,
        });
    }

    // Ensure at least one branch is marked default if list is not empty
    if !branches.is_empty()
        && !branches.iter().any(|b| b.default)
        && let Some(first) = branches.first_mut()
    {
        first.default = true;
    }

    Ok(branches)
}

pub async fn get_local_tree(
    git_dir: &Path,
    ref_name: Option<&str>,
    path: Option<&str>,
) -> Result<Vec<RepoTreeItem>, AppError> {
    let rev = ref_name.filter(|r| !r.is_empty()).unwrap_or("HEAD");
    let mut tree_target = rev.to_string();

    if let Some(p) = path {
        let clean = p.trim_matches('/');
        if !clean.is_empty() {
            tree_target = format!("{rev}:{clean}");
        }
    }

    let output = Command::new("git")
        .arg("-c")
        .arg("core.quotePath=false")
        .arg(format!("--git-dir={}", git_dir.display()))
        .arg("ls-tree")
        .arg("-l")
        .arg(&tree_target)
        .output()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to run git ls-tree: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("Not a valid object name")
            || stderr.contains("unknown revision")
            || stderr.contains("does not have any commits yet")
        {
            return Ok(Vec::new());
        }
        return Err(AppError::NotFound(format!(
            "Path or ref not found: {stderr}"
        )));
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut items = Vec::new();
    let prefix = path.map(|p| p.trim_matches('/')).filter(|p| !p.is_empty());

    for line in text.lines() {
        // Format: <mode> <type> <object> <size>\t<name>
        let tab_parts: Vec<&str> = line.split('\t').collect();
        if tab_parts.len() < 2 {
            continue;
        }

        let raw_name = tab_parts[1].trim();
        let name = raw_name
            .strip_prefix('"')
            .and_then(|p| p.strip_suffix('"'))
            .unwrap_or(raw_name);
        let meta_parts: Vec<&str> = tab_parts[0].split_whitespace().collect();
        if meta_parts.len() < 3 {
            continue;
        }

        let mode = meta_parts[0].to_string();
        let item_type = meta_parts[1].to_string();
        let id = meta_parts[2].to_string();

        let full_item_path = match prefix {
            Some(p) => format!("{p}/{name}"),
            None => name.to_string(),
        };

        items.push(RepoTreeItem {
            id,
            name: name.to_string(),
            item_type,
            path: full_item_path,
            mode,
        });
    }

    Ok(items)
}

pub async fn get_local_blob(
    git_dir: &Path,
    ref_name: Option<&str>,
    file_path: &str,
) -> Result<RepoFileContent, AppError> {
    let rev = ref_name.filter(|r| !r.is_empty()).unwrap_or("HEAD");
    let clean_path = file_path.trim_matches('/');
    let target = format!("{rev}:{clean_path}");

    let output = Command::new("git")
        .arg("-c")
        .arg("core.quotePath=false")
        .arg(format!("--git-dir={}", git_dir.display()))
        .arg("cat-file")
        .arg("-p")
        .arg(&target)
        .output()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read git blob: {e}")))?;

    if !output.status.success() {
        return Err(AppError::NotFound(format!("File not found: {clean_path}")));
    }

    let bytes = output.stdout;
    let size = bytes.len() as i64;

    let (content, is_binary) = if bytes.contains(&0) {
        (String::new(), true)
    } else {
        match String::from_utf8(bytes) {
            Ok(s) => (s, false),
            Err(_) => (String::new(), true),
        }
    };

    // Get last commit for this file
    let commit_output = Command::new("git")
        .arg("-c")
        .arg("core.quotePath=false")
        .arg(format!("--git-dir={}", git_dir.display()))
        .arg("log")
        .arg("-n")
        .arg("1")
        .arg("--format=%H")
        .arg(rev)
        .arg("--")
        .arg(clean_path)
        .output()
        .await
        .ok();

    let commit_id = commit_output
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty());

    let file_name = clean_path
        .split('/')
        .next_back()
        .unwrap_or(clean_path)
        .to_string();

    Ok(RepoFileContent {
        file_name,
        file_path: clean_path.to_string(),
        size,
        content,
        is_binary,
        ref_name: rev.to_string(),
        commit_id: commit_id.clone(),
        last_commit_id: commit_id,
    })
}

pub async fn list_local_commits(
    git_dir: &Path,
    ref_name: Option<&str>,
    path: Option<&str>,
    limit: usize,
) -> Result<Vec<RepoCommit>, AppError> {
    let rev = ref_name.filter(|r| !r.is_empty()).unwrap_or("HEAD");
    let limit_str = limit.clamp(1, 100).to_string();

    let mut cmd = Command::new("git");
    cmd.arg("-c")
        .arg("core.quotePath=false")
        .arg(format!("--git-dir={}", git_dir.display()))
        .arg("log")
        .arg("-n")
        .arg(&limit_str)
        .arg("--pretty=format:%H%x00%h%x00%s%x00%b%x00%an%x00%ae%x00%cI%x01")
        .arg(rev);

    if let Some(p) = path {
        let clean = p.trim_matches('/');
        if !clean.is_empty() {
            cmd.arg("--").arg(clean);
        }
    }

    let output = cmd
        .output()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to list git commits: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("does not have any commits yet")
            || stderr.contains("unknown revision")
            || stderr.contains("bad default revision")
            || stderr.contains("ambiguous argument")
        {
            return Ok(Vec::new());
        }
        return Err(AppError::NotFound("Commits not found".to_string()));
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut commits = Vec::new();

    for record in text.split('\x01') {
        let parts: Vec<&str> = record.trim().split('\0').collect();
        if parts.len() < 7 {
            continue;
        }

        let id = parts[0].to_string();
        let short_id = parts[1].to_string();
        let title = parts[2].to_string();
        let body = parts[3].trim().to_string();
        let author_name = parts[4].to_string();
        let author_email = parts[5].to_string();
        let authored_date = parts[6].to_string();

        let message = if body.is_empty() {
            title.clone()
        } else {
            format!("{title}\n\n{body}")
        };

        commits.push(RepoCommit {
            id,
            short_id,
            title,
            message,
            author_name,
            author_email,
            authored_date: Some(authored_date),
            web_url: None,
        });
    }

    Ok(commits)
}
