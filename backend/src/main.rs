#[tokio::main]
async fn main() -> anyhow::Result<()> {
    gitlab_platform::run().await
}
