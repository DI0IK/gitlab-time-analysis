{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{
  # Rust toolchain
  languages.rust = {
    enable = true;
    components = [
      "rustc"
      "cargo"
      "clippy"
      "rustfmt"
      "rust-analyzer"
    ];
  };

  # Native dependencies and development tools
  packages = with pkgs; [
    # Build tools for native C dependencies (e.g., rusqlite, openssl, resvg)
    cmake
    pkg-config
    openssl
    sqlite

    # Rust developer utilities
    cargo-watch
    cargo-nextest
    cargo-deny
    cargo-audit
    just

    # Network & JSON tools
    curl
    jq
  ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    pnpm = {
      enable = true;
      package = pkgs.pnpm;
    };
  };

  processes = {
    backend.exec = "cargo watch -x 'run --bin gitlab-platform'";
    frontend.exec = "pnpm --dir frontend dev";
  };

  dotenv.enable = true;

  enterShell = ''
    if [ -t 1 ]; then
      echo "=========================================================="
      echo " GitLab Unified Platform v2 Development Environment"
      echo " Architecture: Rust (Axum) + SQLite + Vite / React"
      echo "=========================================================="
      rustc --version
      cargo --version
      node --version
      pnpm --version
      echo ""
      echo "Canonical task runner: just (run 'just' to list commands)"
      echo "=========================================================="
    fi
  '';

  enterTest = ''
    rustc --version
    cargo --version
  '';

  scripts = {
    dev-backend.exec = ''
      echo "==> Starting Rust backend with cargo-watch..."
      cargo watch -x "run --bin gitlab-platform"
    '';

    dev-frontend.exec = ''
      echo "==> Starting Vite development server..."
      pnpm --dir frontend dev
    '';

    build-frontend.exec = ''
      set -e
      echo "==> Building Vite React frontend..."
      pnpm --dir frontend install
      pnpm --dir frontend build
    '';

    build-debug.exec = ''
      set -e
      echo "==> Building frontend assets..."
      pnpm --dir frontend install
      pnpm --dir frontend build
      echo "==> Compiling debug binary..."
      cargo build
    '';

    build-release.exec = ''
      set -e
      echo "==> Building optimized frontend assets..."
      pnpm --dir frontend install
      pnpm --dir frontend build
      echo "==> Compiling optimized release binary..."
      cargo build --release
      echo "==> Release binary ready at target/release/"
    '';
  };
}
