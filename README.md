# GitLab Unified Platform (v2)

High-performance GitLab companion platform: time analysis, gamification, work items, code browser, and merge request review suite.

Built as a modular monolith: a single Rust binary serving an Axum REST API and an embedded Vite/React SPA.

---

## 🏛 Architecture Map

```
gitlab-time-analysis/
├── Cargo.toml                     # workspace: members = ["backend"], shared dependencies & release profile
├── Cargo.lock
├── rustfmt.toml                   # backend formatting standards
├── clippy.toml                    # backend lint thresholds
├── deny.toml                      # license & advisory auditing
├── justfile                       # canonical dev/build/test/gen/db/docker commands
├── .env.example                   # documented environment template
├── .dockerignore
├── Dockerfile                     # multi-stage: node -> cargo-chef musl -> distroless static (<45MB)
├── docker-compose.yml             # standalone container runtime
├── REQUIREMENTS.md                # comprehensive system SRS specification
├── devenv.nix                     # development shell (Rust, Node 24, pnpm, SQLite, just, processes)
│
├── backend/                       # Rust Axum modular backend
│   ├── Cargo.toml
│   ├── openapi.json               # generated OpenAPI 3.1 specification
│   ├── migrations/                # append-only SQLite migrations
│   └── src/
│       ├── main.rs                # lightweight bootstrap (~40 lines)
│       ├── lib.rs                 # application wiring and router setup
│       ├── config.rs              # validated environment configuration
│       ├── error.rs               # structured AppError & HTTP responses
│       ├── state.rs               # AppState (DB pool, HTTP client, cache, config)
│       ├── db/                    # SQLite data access & queries
│       ├── domain/                # pure calculations (metrics, gamification, categories)
│       ├── gitlab/                # GraphQL & REST client adapters
│       ├── ingest/                # background sync workers
│       ├── session/               # OAuth PKCE & encrypted cookie sessions
│       ├── api/                   # Axum controllers & route handlers
│       └── bin/export-openapi.rs  # OpenAPI generator binary
│
└── frontend/                      # Vite + React 19 Single Page Application
    ├── package.json
    ├── vite.config.ts             # Tailwind CSS & backend API proxy
    ├── src/
        ├── routes/                # TanStack Router route definitions (<30 lines each)
        ├── features/              # vertical feature slices (analytics, work items, repo, MRs)
        ├── components/            # UI design system & shared charts
        └── lib/api/               # typed openapi-fetch client generated from backend
```

---

## 🚀 Quick Start

### 1. Requirements

Install [Nix](https://nixos.org/download.html) and [devenv](https://devenv.sh/getting-started/):
```bash
devenv shell
```

### 2. Configure Environment

Copy the example configuration:
```bash
cp .env.example .env
# Edit .env and supply your GITLAB_TOKEN, GITLAB_GROUP_PATH, etc.
```

### 3. Run Development Servers

Using canonical `just` commands inside the devenv shell:
```bash
# Start both backend and frontend development processes
just dev

# Or run separately:
just dev-backend     # cargo watch -x run
just dev-frontend    # pnpm --dir frontend dev
```

---

## 🛠 Canonical Commands (`justfile`)

| Command | Action |
|---|---|
| `just dev` | Start development stack via devenv processes |
| `just check` | Run all lint & type checks (`cargo fmt`, `clippy -D warnings`, `oxlint`, `tsc`) |
| `just test` | Run backend (`cargo nextest`) and frontend unit tests |
| `just fmt` | Format Rust code (`cargo fmt`) and frontend code |
| `just gen-api` | Export OpenAPI from backend and generate typed frontend client |
| `just build` | Compile optimized frontend SPA and release Rust binary |
| `just docker` | Build minimal production Docker container |
| `just docker-up` | Start container stack via `docker compose` |
| `just db-reset` | Clear local SQLite development database |

---

## 📦 How to Add Features

### 1. Adding an API Endpoint
1. Define request/response DTOs in `backend/src/api/<feature>/dto.rs`.
2. Add route handler in `backend/src/api/<feature>.rs`.
3. Register route in `backend/src/api/mod.rs` and add DTO to `backend/src/api/openapi.rs`.
4. Run `just gen-api` to generate client TypeScript types in `frontend/src/lib/api/schema.d.ts`.

### 2. Adding a Database Table or Query
1. Create a new append-only SQL migration file in `backend/migrations/<number>_<name>.sql`. Never edit previous migrations.
2. Add typed queries and row structs in `backend/src/db/<aggregate>.rs`.

### 3. Adding a Metric or Gamification Rule
1. Implement pure logic with unit tests in `backend/src/domain/metrics.rs` or `backend/src/domain/gamification/`.
2. Expose the metric via the corresponding screen BFF DTO in `backend/src/api/analytics/`.

### 4. Adding a Frontend Route / View
1. Create a thin route in `frontend/src/routes/<path>.tsx` (< 30 lines).
2. Implement feature components in `frontend/src/features/<feature>/`.
3. Fetch data using the typed client `src/lib/api/client.ts`.

---

## 🐳 Docker Deployment

The production image uses a multi-stage musl build and distroless static base:
```bash
docker compose up -d
```
The application will be accessible on `http://localhost:3000` with persistent SQLite data mounted in `platform-data`.
