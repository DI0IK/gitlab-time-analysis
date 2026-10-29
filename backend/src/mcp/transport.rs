use std::{convert::Infallible, time::Duration};

use axum::{
    Json,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{
        IntoResponse, Response,
        sse::{Event, KeepAlive, Sse},
    },
};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::mpsc;
use tokio_stream::{StreamExt, wrappers::ReceiverStream};
use uuid::Uuid;

use crate::{
    api::extractors::AuthUser,
    error::AppError,
    mcp::{
        protocol::{
            INTERNAL_ERROR, INVALID_PARAMS, InitializeResult, JsonRpcRequest, JsonRpcResponse,
            METHOD_NOT_FOUND, ResourcesCapability, ServerCapabilities, ServerInfo, ToolsCapability,
        },
        resources::{list_resources, read_resource},
        tools::{execute_tool, list_tools},
    },
    state::AppState,
};

struct SessionGuard<S> {
    inner: S,
    sessions: crate::mcp::session::McpSessionRegistry,
    session_id: String,
}

impl<S> Drop for SessionGuard<S> {
    fn drop(&mut self) {
        let sessions = self.sessions.clone();
        let sid = self.session_id.clone();
        tokio::spawn(async move {
            sessions.remove(&sid).await;
        });
    }
}

impl<S: tokio_stream::Stream + Unpin> tokio_stream::Stream for SessionGuard<S> {
    type Item = S::Item;
    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        std::pin::Pin::new(&mut self.inner).poll_next(cx)
    }
}

#[derive(Debug, Deserialize)]
pub struct MessageQuery {
    #[serde(alias = "sessionId")]
    pub session_id: Option<String>,
}

pub async fn handle_sse(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>> + Send + 'static> {
    let session_id = Uuid::new_v4().to_string();
    let (tx, rx) = mpsc::channel::<String>(128);

    state
        .mcp_sessions
        .insert(session_id.clone(), auth, tx)
        .await;

    let initial_endpoint_event = Event::default()
        .event("endpoint")
        .data(format!("/api/mcp/messages?sessionId={session_id}"));

    let message_stream =
        ReceiverStream::new(rx).map(|msg| Ok(Event::default().event("message").data(msg)));

    let stream = tokio_stream::once(Ok(initial_endpoint_event)).chain(message_stream);

    let guarded = SessionGuard {
        inner: Box::pin(stream),
        sessions: state.mcp_sessions.clone(),
        session_id,
    };

    Sse::new(guarded).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    )
}

pub async fn handle_message(
    State(state): State<AppState>,
    auth: AuthUser,
    headers: HeaderMap,
    Query(query): Query<MessageQuery>,
    Json(req): Json<JsonRpcRequest>,
) -> Result<Response, AppError> {
    let incoming_session_id = query.session_id.or_else(|| {
        headers
            .get("mcp-session-id")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string())
    });

    let session_id = incoming_session_id.unwrap_or_else(|| {
        if req.method == "initialize" {
            Uuid::new_v4().to_string()
        } else {
            String::new()
        }
    });

    let id_val = req.id.clone().unwrap_or(json!(null));

    // Notifications (no id) do not expect a JSON-RPC response
    if req.id.is_none() && req.method.starts_with("notifications/") {
        tracing::debug!(method = %req.method, "Received MCP notification");
        let mut resp = StatusCode::ACCEPTED.into_response();
        if !session_id.is_empty()
            && let Ok(hdr) = session_id.parse()
        {
            resp.headers_mut().insert("mcp-session-id", hdr);
        }
        return Ok(resp);
    }

    let response = match req.method.as_str() {
        "initialize" => {
            let result = InitializeResult {
                protocol_version: "2024-11-05".to_string(),
                server_info: ServerInfo {
                    name: "gitlab-unified-platform".to_string(),
                    version: "0.1.0".to_string(),
                },
                capabilities: ServerCapabilities {
                    tools: Some(ToolsCapability {
                        list_changed: false,
                    }),
                    resources: Some(ResourcesCapability {
                        subscribe: false,
                        list_changed: false,
                    }),
                },
            };
            JsonRpcResponse::success(id_val, json!(result))
        }
        "ping" => JsonRpcResponse::success(id_val, json!({})),
        "tools/list" => {
            let tools = list_tools();
            JsonRpcResponse::success(id_val, json!({ "tools": tools }))
        }
        "tools/call" => {
            let params = req.params.unwrap_or(json!({}));
            let tool_name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

            if tool_name.is_empty() {
                JsonRpcResponse::error(
                    id_val,
                    INVALID_PARAMS,
                    "Tool name is required in params.name",
                    None,
                )
            } else {
                let tool_result = execute_tool(&state, &auth, tool_name, &arguments).await;
                JsonRpcResponse::success(id_val, json!(tool_result))
            }
        }
        "resources/list" => {
            let resources = list_resources();
            JsonRpcResponse::success(id_val, json!({ "resources": resources }))
        }
        "resources/read" => {
            let params = req.params.unwrap_or(json!({}));
            let uri = params.get("uri").and_then(|v| v.as_str()).unwrap_or("");

            if uri.is_empty() {
                JsonRpcResponse::error(
                    id_val,
                    INVALID_PARAMS,
                    "Resource URI is required in params.uri",
                    None,
                )
            } else {
                match read_resource(&state, &auth, uri).await {
                    Ok(res) => JsonRpcResponse::success(id_val, json!(res)),
                    Err(e) => JsonRpcResponse::error(id_val, INTERNAL_ERROR, e, None),
                }
            }
        }
        other => JsonRpcResponse::error(
            id_val,
            METHOD_NOT_FOUND,
            format!("Method not supported: {other}"),
            None,
        ),
    };

    let response_json = serde_json::to_string(&response).unwrap_or_default();

    // If an SSE session is active for this client, forward the response through SSE as well
    if !session_id.is_empty() {
        state
            .mcp_sessions
            .send_message(&session_id, response_json.clone())
            .await;
    }

    let mut resp = (StatusCode::OK, Json(response)).into_response();
    if !session_id.is_empty()
        && let Ok(hdr) = session_id.parse()
    {
        resp.headers_mut().insert("mcp-session-id", hdr);
    }

    Ok(resp)
}
