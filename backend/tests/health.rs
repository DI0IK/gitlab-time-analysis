use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use tower::ServiceExt;

mod common;

#[tokio::test]
async fn test_health_endpoint() {
    let (state, _pool) = common::setup_test_state().await;
    let app = gitlab_platform::app(state);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["status"], "ok");
    assert_eq!(json["database"], "ok");
}

#[tokio::test]
async fn test_meta_endpoint() {
    let (state, _pool) = common::setup_test_state().await;
    let app = gitlab_platform::app(state);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/meta")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json["categories"].as_array().unwrap().len() >= 4);
    assert_eq!(json["tiers"].as_array().unwrap().len(), 4);
    assert!(!json["badges"].as_array().unwrap().is_empty());
}
