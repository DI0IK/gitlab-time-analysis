use gitlab_platform::api::openapi::ApiDoc;
use std::env;
use std::path::Path;
use utoipa::OpenApi;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let spec = ApiDoc::openapi().to_pretty_json()?;
    let args: Vec<String> = env::args().collect();
    if args.len() > 1 {
        let path = Path::new(&args[1]);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, spec)?;
        eprintln!("Exported OpenAPI specification to {}", path.display());
    } else {
        println!("{spec}");
    }
    Ok(())
}
