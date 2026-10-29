use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use serde_json::json;
use tower::ServiceExt;

use gitlab_platform::{
    app,
    db::api_keys::{create_api_key, get_api_key_with_user, list_api_keys_for_user},
    session::crypto::{generate_api_key, hash_api_key},
};

mod common;

#[tokio::test]
async fn test_api_key_generation_and_db_flow() {
    let (state, pool) = common::setup_test_state().await;
    let (user, _cookie) = common::create_test_session(&state, &pool).await;

    let (raw_key, prefix, hash) = generate_api_key();
    assert!(raw_key.starts_with("glta_"));
    assert_eq!(prefix, raw_key[..10]);
    assert_eq!(hash, hash_api_key(&raw_key));

    // 1. Create key
    let record = create_api_key(
        &pool,
        "test-key-id-1",
        &user.gitlab_id,
        "Cursor IDE",
        &prefix,
        &hash,
        "read,mcp",
        None,
    )
    .await
    .expect("create_api_key succeeds");

    assert_eq!(record.name, "Cursor IDE");
    assert_eq!(record.key_prefix, prefix);

    // 2. Lookup key with user by hash
    let found = get_api_key_with_user(&pool, &hash)
        .await
        .expect("get_api_key_with_user query succeeds");
    assert!(found.is_some());
    let (k, u) = found.unwrap();
    assert_eq!(k.id, "test-key-id-1");
    assert_eq!(u.username, user.username);

    // 3. List keys for user
    let keys = list_api_keys_for_user(&pool, &user.gitlab_id)
        .await
        .expect("list_api_keys_for_user succeeds");
    assert_eq!(keys.len(), 1);
    assert_eq!(keys[0].name, "Cursor IDE");
}

#[tokio::test]
async fn test_api_key_auth_and_mcp_endpoints() {
    let (state, pool) = common::setup_test_state().await;
    let (user, cookie) = common::create_test_session(&state, &pool).await;
    let app_router = app(state.clone());

    // 1. Generate an API Key via HTTP POST /api/user/api-keys using session cookie
    let create_req = Request::builder()
        .method("POST")
        .uri("/api/user/api-keys")
        .header(header::COOKIE, &cookie)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "name": "Antigravity Assistant",
                "expires_in_days": 30
            })
            .to_string(),
        ))
        .unwrap();

    let res = app_router.clone().oneshot(create_req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let body_bytes = axum::body::to_bytes(res.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let created_key_resp: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    let raw_token = created_key_resp["key"]
        .as_str()
        .expect("raw token returned");
    assert!(raw_token.starts_with("glta_"));

    // 2. Access protected endpoint /api/user/profile using the Bearer API Key!
    let profile_req = Request::builder()
        .method("GET")
        .uri("/api/user/profile")
        .header(header::AUTHORIZATION, format!("Bearer {raw_token}"))
        .body(Body::empty())
        .unwrap();

    let profile_res = app_router.clone().oneshot(profile_req).await.unwrap();
    assert_eq!(profile_res.status(), StatusCode::OK);

    // 3. Send MCP initialize JSON-RPC request to /api/mcp/messages
    let init_rpc = Request::builder()
        .method("POST")
        .uri("/api/mcp/messages")
        .header(header::AUTHORIZATION, format!("Bearer {raw_token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {}
            })
            .to_string(),
        ))
        .unwrap();

    let init_res = app_router.clone().oneshot(init_rpc).await.unwrap();
    assert_eq!(init_res.status(), StatusCode::OK);

    let init_bytes = axum::body::to_bytes(init_res.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let init_json: serde_json::Value = serde_json::from_slice(&init_bytes).unwrap();
    assert_eq!(init_json["jsonrpc"], "2.0");
    assert_eq!(init_json["result"]["protocolVersion"], "2024-11-05");
    assert_eq!(
        init_json["result"]["serverInfo"]["name"],
        "gitlab-unified-platform"
    );

    // 4. Send MCP tools/list request
    let tools_rpc = Request::builder()
        .method("POST")
        .uri("/api/mcp/messages")
        .header(header::AUTHORIZATION, format!("Bearer {raw_token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {}
            })
            .to_string(),
        ))
        .unwrap();

    let tools_res = app_router.clone().oneshot(tools_rpc).await.unwrap();
    assert_eq!(tools_res.status(), StatusCode::OK);

    let tools_bytes = axum::body::to_bytes(tools_res.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let tools_json: serde_json::Value = serde_json::from_slice(&tools_bytes).unwrap();
    let tool_names: Vec<&str> = tools_json["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|t| t["name"].as_str())
        .collect();

    assert!(tool_names.contains(&"list_accessible_groups"));
    assert!(tool_names.contains(&"get_group_metrics"));
    assert!(tool_names.contains(&"query_work_items"));
    assert!(tool_names.contains(&"get_work_item_details"));
    assert!(tool_names.contains(&"query_timelogs"));
    assert!(tool_names.contains(&"get_user_analytics"));
    assert!(tool_names.contains(&"query_merge_requests"));
    assert!(tool_names.contains(&"get_wiki_page"));
    // Ensure trigger_sync was NOT implemented per user request
    assert!(!tool_names.contains(&"trigger_sync"));

    // 5. Execute tool: list_accessible_groups
    let call_rpc = Request::builder()
        .method("POST")
        .uri("/api/mcp/messages")
        .header(header::AUTHORIZATION, format!("Bearer {raw_token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "list_accessible_groups",
                    "arguments": {}
                }
            })
            .to_string(),
        ))
        .unwrap();

    let call_res = app_router.clone().oneshot(call_rpc).await.unwrap();
    assert_eq!(call_res.status(), StatusCode::OK);

    // 6. Test resources/list
    let res_rpc = Request::builder()
        .method("POST")
        .uri("/api/mcp/messages")
        .header(header::AUTHORIZATION, format!("Bearer {raw_token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "jsonrpc": "2.0",
                "id": 4,
                "method": "resources/list",
                "params": {}
            })
            .to_string(),
        ))
        .unwrap();

    let res_resp = app_router.clone().oneshot(res_rpc).await.unwrap();
    assert_eq!(res_resp.status(), StatusCode::OK);

    // 7. Seed Managed Root Group, GitLab Group, Work Item, and Timelog
    let start_date = chrono::NaiveDate::from_ymd_opt(2025, 10, 1).unwrap();
    gitlab_platform::db::managed_root_groups::create_managed_root_group(
        &pool,
        "mrg_1",
        "tinf24",
        "DHBW TINF24",
        "dhbw/tinf24",
        None,
        start_date,
        None,
        "Monday",
        1,
    )
    .await
    .unwrap();

    gitlab_platform::db::permissions::upsert_user_permission(
        &pool,
        &user.gitlab_id,
        "mrg_1",
        "manual",
    )
    .await
    .unwrap();

    let now = chrono::Utc::now();
    let group = gitlab_platform::db::groups::upsert_group(
        &pool,
        "gid://gitlab/Group/10",
        "dhbw/tinf24",
        "DHBW TINF24",
        None,
        None,
        0,
        "https://gitlab.com/dhbw/tinf24",
        now,
    )
    .await
    .unwrap();

    let issue = gitlab_platform::db::work_items::upsert_work_item(
        &pool,
        "wi-1",
        Some(&group.id),
        None,
        1,
        "issue",
        None,
        "Fix bug in parser",
        Some("Detailed bug report"),
        "opened",
        3600,
        3600,
        "https://gitlab.com/dhbw/tinf24/-/work_items/1",
        "[]",
        None,
        None,
        now,
        None,
        now,
    )
    .await
    .unwrap();

    gitlab_platform::db::timelogs::upsert_timelog(
        &pool,
        "tl-1",
        Some(&issue.id),
        None,
        "testadmin",
        now,
        3600,
        Some("Worked on parser fix"),
        &issue.web_url,
        Some(1),
        now,
    )
    .await
    .unwrap();

    // 8. Test query_work_items tool
    let wi_rpc = Request::builder()
        .method("POST")
        .uri("/api/mcp/messages")
        .header(header::AUTHORIZATION, format!("Bearer {raw_token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "jsonrpc": "2.0",
                "id": 5,
                "method": "tools/call",
                "params": {
                    "name": "query_work_items",
                    "arguments": {
                        "root_slug": "tinf24"
                    }
                }
            })
            .to_string(),
        ))
        .unwrap();

    let wi_res = app_router.clone().oneshot(wi_rpc).await.unwrap();
    assert_eq!(wi_res.status(), StatusCode::OK);
    let wi_bytes = axum::body::to_bytes(wi_res.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let wi_json: serde_json::Value = serde_json::from_slice(&wi_bytes).unwrap();
    let wi_text = wi_json["result"]["content"][0]["text"].as_str().unwrap();
    assert!(wi_text.contains("Fix bug in parser"));

    // 9. Test query_timelogs tool
    let tl_rpc = Request::builder()
        .method("POST")
        .uri("/api/mcp/messages")
        .header(header::AUTHORIZATION, format!("Bearer {raw_token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "jsonrpc": "2.0",
                "id": 6,
                "method": "tools/call",
                "params": {
                    "name": "query_timelogs",
                    "arguments": {
                        "root_slug": "tinf24"
                    }
                }
            })
            .to_string(),
        ))
        .unwrap();

    let tl_res = app_router.clone().oneshot(tl_rpc).await.unwrap();
    assert_eq!(tl_res.status(), StatusCode::OK);
    let tl_bytes = axum::body::to_bytes(tl_res.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let tl_json: serde_json::Value = serde_json::from_slice(&tl_bytes).unwrap();
    let tl_text = tl_json["result"]["content"][0]["text"].as_str().unwrap();
    assert!(tl_text.contains("Worked on parser fix"));
    assert!(tl_text.contains("3600"));
}
