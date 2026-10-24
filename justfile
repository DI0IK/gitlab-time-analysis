# Justfile - canonical command surface for gitlab-time-analysis

set shell := ["bash", "-uc"]

# Show available commands
default:
    @just --list

# Start development environment (both backend and frontend via devenv)
dev:
    devenv up

# Run backend only with hot reloading
dev-backend:
    cargo watch -x "run --bin gitlab-platform"

# Run frontend only with Vite dev server
dev-frontend:
    pnpm --dir frontend dev

# Run all lint and type checks across backend and frontend
check: check-backend check-frontend

check-backend:
    cargo fmt --check
    cargo clippy --all-targets --all-features -- -D warnings

check-frontend:
    pnpm --dir frontend lint
    pnpm --dir frontend typecheck

# Format all code across backend and frontend
fmt:
    cargo fmt
    pnpm --dir frontend exec biome format --write . || true

# Run all test suites
test: test-backend test-frontend

test-backend:
    cargo test

test-frontend:
    pnpm --dir frontend test || true

# Export OpenAPI schema from backend and generate frontend TypeScript types
gen-api:
    cargo run --bin export-openapi backend/openapi.json
    pnpm --dir frontend exec openapi-typescript ../backend/openapi.json -o ./src/lib/api/schema.d.ts

# Build release artifacts for both frontend and backend
build: build-frontend build-backend

build-frontend:
    pnpm --dir frontend install
    pnpm --dir frontend build

build-backend:
    cargo build --release

# Build and package Docker image
docker:
    docker build -t gitlab-time-analysis:latest .

# Run container stack with docker-compose
docker-up:
    docker compose up -d

# Stop container stack
docker-down:
    docker compose down

# Reset local SQLite database
db-reset:
    rm -f local.db local.db-shm local.db-wal data/app.db data/app.db-shm data/app.db-wal
    @echo "==> Local SQLite databases cleared."
