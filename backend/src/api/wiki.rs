use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use crate::{
    api::extractors::OptionalAuthUser,
    api::repo::RepoCommit,
    db::groups::get_group_by_slug,
    error::AppError,
    git::{
        mirror::{get_repo_dir, sync_bare_repo},
        repo_reader::list_local_commits,
        wiki_reader::{WikiPageContent, WikiPageItem, get_local_wiki_page, list_local_wiki_pages},
    },
    state::AppState,
};

#[derive(Debug, Deserialize, IntoParams)]
pub struct WikiPagesQuery {
    pub project: String,
    #[serde(rename = "ref")]
    pub ref_name: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct WikiPageQuery {
    pub project: String,
    pub slug: String,
    #[serde(rename = "ref")]
    pub ref_name: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct WikiHistoryQuery {
    pub project: String,
    pub slug: Option<String>,
    pub limit: Option<usize>,
}

fn get_token(state: &AppState, target: &str, auth: &OptionalAuthUser) -> Option<String> {
    auth.0
        .as_ref()
        .map(|u| u.access_token.clone())
        .or_else(|| state.config.get_token_for_path(target))
}

#[utoipa::path(
    get,
    path = "/api/wiki/pages",
    tag = "Wiki",
    params(WikiPagesQuery),
    responses(
        (status = 200, description = "List of all wiki pages in the repository or group", body = Vec<WikiPageItem>),
        (status = 404, description = "Wiki not found")
    )
)]
pub async fn list_wiki_pages(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Query(query): Query<WikiPagesQuery>,
) -> Result<Json<Vec<WikiPageItem>>, AppError> {
    let git_dir = get_repo_dir(&state.config.repos_dir, &query.project, true);

    // If wiki mirror does not exist yet, try to sync it
    if !git_dir.join("HEAD").exists() {
        let token = get_token(&state, &query.project, &auth);
        match sync_bare_repo(
            &state.config.repos_dir,
            &state.config.gitlab_domain,
            &query.project,
            token.as_deref(),
            true,
        )
        .await
        {
            Ok(_) => {}
            Err(AppError::NotFound(_)) => {
                // Wiki simply does not exist for this project
                return Ok(Json(Vec::new()));
            }
            Err(e) => return Err(e),
        }
    }

    let pages = list_local_wiki_pages(&git_dir, query.ref_name.as_deref()).await?;
    Ok(Json(pages))
}

#[utoipa::path(
    get,
    path = "/api/wiki/page",
    tag = "Wiki",
    params(WikiPageQuery),
    responses(
        (status = 200, description = "Wiki page content and metadata", body = WikiPageContent),
        (status = 404, description = "Wiki page not found")
    )
)]
pub async fn get_wiki_page(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Query(query): Query<WikiPageQuery>,
) -> Result<Json<WikiPageContent>, AppError> {
    let git_dir = get_repo_dir(&state.config.repos_dir, &query.project, true);

    if !git_dir.join("HEAD").exists() {
        let token = get_token(&state, &query.project, &auth);
        sync_bare_repo(
            &state.config.repos_dir,
            &state.config.gitlab_domain,
            &query.project,
            token.as_deref(),
            true,
        )
        .await?;
    }

    let page = get_local_wiki_page(&git_dir, &query.slug, query.ref_name.as_deref()).await?;
    Ok(Json(page))
}

#[utoipa::path(
    get,
    path = "/api/wiki/history",
    tag = "Wiki",
    params(WikiHistoryQuery),
    responses(
        (status = 200, description = "Revision history for a wiki page or entire wiki", body = Vec<RepoCommit>),
        (status = 404, description = "Page not found")
    )
)]
pub async fn get_wiki_history(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Query(query): Query<WikiHistoryQuery>,
) -> Result<Json<Vec<RepoCommit>>, AppError> {
    let git_dir = get_repo_dir(&state.config.repos_dir, &query.project, true);

    if !git_dir.join("HEAD").exists() {
        let token = get_token(&state, &query.project, &auth);
        sync_bare_repo(
            &state.config.repos_dir,
            &state.config.gitlab_domain,
            &query.project,
            token.as_deref(),
            true,
        )
        .await?;
    }

    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let target_path = if let Some(slug) = &query.slug
        && !slug.is_empty()
    {
        let page = get_local_wiki_page(&git_dir, slug, None).await?;
        Some(page.path)
    } else {
        None
    };

    let commits = list_local_commits(&git_dir, Some("HEAD"), target_path.as_deref(), limit).await?;
    Ok(Json(commits))
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WikiTarget {
    pub path: String,
    pub name: String,
    pub target_type: String, // "group", "subgroup", or "project"
    pub has_wiki: bool,
    pub page_count: usize,
}

#[utoipa::path(
    get,
    path = "/api/groups/{slug}/wiki/targets",
    tag = "Wiki",
    params(
        ("slug" = String, Path, description = "Group slug or identifier")
    ),
    responses(
        (status = 200, description = "List of all groups, subgroups, and projects with wiki status", body = Vec<WikiTarget>),
        (status = 404, description = "Group not found")
    )
)]
pub async fn get_group_wiki_targets(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<Vec<WikiTarget>>, AppError> {
    let group = get_group_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group '{slug}' not found")))?;

    let mut targets = Vec::new();

    // 1. Root group wiki
    let root_git_dir = get_repo_dir(&state.config.repos_dir, &group.full_path, true);
    let root_has_wiki = root_git_dir.join("HEAD").exists();
    let root_page_count = if root_has_wiki {
        list_local_wiki_pages(&root_git_dir, None)
            .await
            .map(|p| p.len())
            .unwrap_or(0)
    } else {
        0
    };
    targets.push(WikiTarget {
        path: group.full_path.clone(),
        name: format!("{} (Group Wiki)", group.name),
        target_type: "group".to_string(),
        has_wiki: root_has_wiki && root_page_count > 0,
        page_count: root_page_count,
    });

    // 2. Subgroups wikis
    let prefix = format!("{}/%", group.full_path.trim_end_matches('/'));
    let subgroups = sqlx::query_as::<_, (String, String)>(
        "SELECT full_path, name FROM groups WHERE full_path LIKE ?1 ORDER BY full_path ASC",
    )
    .bind(&prefix)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (subgroup_path, subgroup_name) in subgroups {
        let git_dir = get_repo_dir(&state.config.repos_dir, &subgroup_path, true);
        let has_wiki = git_dir.join("HEAD").exists();
        let page_count = if has_wiki {
            list_local_wiki_pages(&git_dir, None)
                .await
                .map(|p| p.len())
                .unwrap_or(0)
        } else {
            0
        };
        targets.push(WikiTarget {
            path: subgroup_path,
            name: format!("{subgroup_name} (Subgroup Wiki)"),
            target_type: "subgroup".to_string(),
            has_wiki: has_wiki && page_count > 0,
            page_count,
        });
    }

    // 3. Project wikis
    let clean = group.full_path.trim_end_matches('/');
    let project_paths = sqlx::query_scalar::<_, String>(
        r#"
        SELECT DISTINCT path FROM (
            SELECT DISTINCT full_path as path FROM projects
            WHERE (full_path LIKE ?1 OR full_path = ?2) AND archived = 0
            UNION
            SELECT DISTINCT project_path as path FROM work_items 
            WHERE project_path IS NOT NULL 
              AND work_item_type != 'epic' 
              AND (project_path LIKE ?1 OR project_path = ?2)
            UNION
            SELECT DISTINCT project_path as path FROM merge_requests 
            WHERE project_path IS NOT NULL 
              AND (project_path LIKE ?1 OR project_path = ?2)
        )
        WHERE path NOT IN (SELECT full_path FROM groups)
        ORDER BY path ASC
        "#,
    )
    .bind(&prefix)
    .bind(clean)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for proj_path in project_paths {
        let git_dir = get_repo_dir(&state.config.repos_dir, &proj_path, true);
        let has_wiki = git_dir.join("HEAD").exists();
        let page_count = if has_wiki {
            list_local_wiki_pages(&git_dir, None)
                .await
                .map(|p| p.len())
                .unwrap_or(0)
        } else {
            0
        };
        let short_name = proj_path
            .split('/')
            .next_back()
            .unwrap_or(&proj_path)
            .to_string();
        targets.push(WikiTarget {
            path: proj_path,
            name: short_name,
            target_type: "project".to_string(),
            has_wiki: has_wiki && page_count > 0,
            page_count,
        });
    }

    Ok(Json(targets))
}
