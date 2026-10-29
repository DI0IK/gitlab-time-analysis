use std::{collections::HashMap, sync::Arc};
use tokio::sync::{RwLock, mpsc};

use crate::api::extractors::AuthUser;

#[derive(Clone)]
pub struct McpSession {
    pub session_id: String,
    pub auth_user: AuthUser,
    pub tx: mpsc::Sender<String>,
}

#[derive(Clone, Default)]
pub struct McpSessionRegistry {
    sessions: Arc<RwLock<HashMap<String, McpSession>>>,
}

impl McpSessionRegistry {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn insert(&self, session_id: String, auth_user: AuthUser, tx: mpsc::Sender<String>) {
        let mut map = self.sessions.write().await;
        map.insert(
            session_id.clone(),
            McpSession {
                session_id,
                auth_user,
                tx,
            },
        );
    }

    pub async fn get(&self, session_id: &str) -> Option<McpSession> {
        let map = self.sessions.read().await;
        map.get(session_id).cloned()
    }

    pub async fn remove(&self, session_id: &str) {
        let mut map = self.sessions.write().await;
        map.remove(session_id);
    }

    pub async fn send_message(&self, session_id: &str, message: String) -> bool {
        if let Some(session) = self.get(session_id).await {
            session.tx.send(message).await.is_ok()
        } else {
            false
        }
    }
}
