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

    # Node.js ecosystem for Vite + React frontend
    nodejs
    nodePackages.pnpm

    # Network & JSON tools
    curl
    jq
  ];

  dotenv.enable = true;

  enterShell = ''
    echo "=========================================================="
    echo " GitLab Unified Platform v2 Development Environment"
    echo " Architecture: Rust (Axum) + SQLite + Vite / React"
    echo "=========================================================="
    rustc --version
    cargo --version
    node --version
    echo ""
    echo "Available commands:"
    echo "  devenv tasks run build-release - Build frontend & optimized backend"
    echo "  dev-backend                    - Run backend with hot reloading (cargo-watch)"
    echo "  dev-frontend                   - Run Vite development server"
    echo "=========================================================="
  '';

  enterTest = ''
    rustc --version
    cargo --version
  '';

  scripts = {
    dev-backend.exec = ''
      echo "==> Starting Rust backend with cargo-watch..."
      cargo watch -x "run"
    '';

    dev-frontend.exec = ''
      echo "==> Starting Vite development server..."
      if [ -d "frontend" ]; then
        npm --prefix frontend run dev
      else
        echo "No 'frontend' directory found yet."
      fi
    '';

    build-frontend.exec = ''
      set -e
      if [ -d "frontend" ]; then
        echo "==> Building Vite React frontend..."
        npm --prefix frontend install
        npm --prefix frontend run build
      else
        echo "No 'frontend' directory found to build."
      fi
    '';

    build-debug.exec = ''
      set -e
      if [ -d "frontend" ]; then
        echo "==> Building frontend assets..."
        npm --prefix frontend install
        npm --prefix frontend run build
      fi
      echo "==> Compiling debug binary..."
      cargo build
    '';

    build-release.exec = ''
      set -e
      if [ -d "frontend" ]; then
        echo "==> Building optimized frontend assets..."
        npm --prefix frontend install
        npm --prefix frontend run build
      fi
      echo "==> Compiling optimized release binary..."
      cargo build --release
      echo "==> Release binary ready at target/release/"
    '';
  };
}
