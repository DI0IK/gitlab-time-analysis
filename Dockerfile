# ==============================================================================
# Stage 1: Build Frontend SPA
# ==============================================================================
FROM docker.io/library/node:24-alpine AS frontend-builder
WORKDIR /app/frontend

RUN corepack enable && corepack prepare pnpm@latest --activate
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

# ==============================================================================
# Stage 2: Cargo Chef Planner
# ==============================================================================
FROM docker.io/lukemathwalker/cargo-chef:latest-rust-alpine AS chef
WORKDIR /app
RUN apk add --no-cache musl-dev openssl-dev openssl-libs-static pkgconfig curl

FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY backend/Cargo.toml backend/
COPY backend/src backend/src
RUN cargo chef prepare --recipe-path recipe.json

# ==============================================================================
# Stage 3: Build Backend (Statically Linked musl)
# ==============================================================================
FROM chef AS backend-builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --target x86_64-unknown-linux-musl --recipe-path recipe.json

COPY Cargo.toml Cargo.lock ./
COPY backend backend
RUN cargo build --release --target x86_64-unknown-linux-musl --bin gitlab-platform

# ==============================================================================
# Stage 4: Minimal Runtime with Git & CA Certificates
# ==============================================================================
FROM docker.io/library/alpine:3.20
WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata \
    && mkdir -p /app /data/repos

COPY --from=backend-builder /app/target/x86_64-unknown-linux-musl/release/gitlab-platform /app/gitlab-platform
COPY --from=frontend-builder /app/frontend/dist /app/public

ENV PORT=3000 \
    HOST=0.0.0.0 \
    FRONTEND_DIST=/app/public \
    DATABASE_URL=sqlite:///data/platform.db?mode=rwc \
    REPOS_DIR=/data/repos \
    RUST_LOG=info,gitlab_platform=info

VOLUME ["/data"]
EXPOSE 3000

ENTRYPOINT ["/app/gitlab-platform"]
