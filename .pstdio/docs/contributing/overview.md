This Project is a Bun + TypeScript monorepo using workspaces (Lerna + Nx cache), Vite, Hono, and Chakra UI.

## Prerequisites

- Bun `>=1.3.10`
- Docker (for remote/sync setup)

## Install

```bash
bun install
```

## Run Locally

By default everything runs against a local PGlite database.

```bash
bun run dev:dashboard
bun run dev:api
bun run dev:landing-page
bun run --cwd webapps/documentation docs:dev
```

Desktop app (Electron — requires the API and dashboard dev servers above):

```bash
bun run dev:desktop
```

### Drizzle Studio

Inspect and edit data visually with Drizzle Studio.

**Local PGlite database:**

```bash
bun run --cwd packages/db studio
```

Opens Studio against the local `packages/api/todos.db` file (default path).

**Remote Postgres database** (requires Docker services running, see [Remote Setup](#remote-setup-postgres--electric)):

```bash
bun run --cwd packages/db studio:pg
```

Connects to `postgresql://postgres:password@localhost:54321/electric` by default. Override with `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://postgres:password@localhost:54321/electric bun run --cwd packages/db studio:pg
```

Both commands start Studio on `https://local.drizzle.studio`.

## Workspaces

Workspaces isolate data sets. Each todo belongs to exactly one workspace.

### CLI commands

```bash
bun run --cwd packages/cli mono workspace list
bun run --cwd packages/cli mono workspace create <name>
bun run --cwd packages/cli mono workspace switch <name-or-id>
bun run --cwd packages/cli mono workspace delete <name-or-id>
```

A `default` workspace is auto-created on first use in local mode.

### Dashboard

The dashboard sidebar shows a workspace picker. Click a workspace to switch, use the input field to create new ones.

## CLI

The CLI (`mono`) manages todos from the terminal. Run commands directly with Bun:

```bash
bun run --cwd packages/cli mono todos list
bun run --cwd packages/cli mono todos add "Buy groceries"
bun run --cwd packages/cli mono todos add "Milk" --parent <id>
bun run --cwd packages/cli mono todos done <id>
bun run --cwd packages/cli mono todos undone <id>
bun run --cwd packages/cli mono todos edit <id> "New title"
bun run --cwd packages/cli mono todos rm <id>
```

`<id>` is a prefix of the todo's UUID (the first 8 characters shown by `list`).

## Storybook

Run the UI Storybook locally:

```bash
bun run storybook:ui
```

Build static Storybook files:

```bash
bun run --cwd packages/ui build-storybook
```

Run Storybook component tests:

```bash
bun run --cwd packages/ui test-storybook
```

Storybook testing guidance for the UI package:

- `packages/ui/README.md`

## E2E Tests (Playwright)

Run the UI E2E suite:

```bash
bun run test:e2e
```

Run a single spec:

```bash
bun run test:e2e -- src/ui/todo-crud.spec.ts
```

Run headed:

```bash
bun run test:e2e -- --headed
```

Playwright report output:

- `packages/e2e/playwright-report/index.html`

The E2E config automatically starts:

- API on a dynamically selected free localhost port
- Dashboard on a dynamically selected free localhost port

### E2E Tests (Electric + Postgres)

These tests exercise the remote Postgres + Electric sync pipeline. The runner starts an isolated Docker Compose project with random host ports, runs migrations, executes tests, and tears everything down.

```bash
# Run the Electric e2e suite (isolated from existing compose stacks)
bun run --cwd packages/e2e test:electric
```

The suite no longer depends on fixed `localhost:54321` / `localhost:3001` bindings.

The suite covers:

- **outbox-sync** — local insert → outbox worker → Postgres (two-server architecture)
- **workspace-sync-isolation** — remote workspace syncs to Postgres + SSE notifications; local workspace stays isolated
- **remote-crud** — Postgres CRUD through the API
- **gatekeeper** — JWT token issuance and validation
- **shape-proxy** — proxy auth enforcement (401/403 on invalid tokens)
- **sync-roundtrip** — write to Postgres, sync via Electric shape stream, verify in local PGlite

## Project Validation

After making changes, run:

```bash
bun run format
bun run lint
bun run build
bun run test
```

## Docker Compose Deployment

This repository includes a full deployment stack in `deployment/dashboard/docker-compose.yml`:

| Service         | Port  | Description                                           |
| --------------- | ----- | ----------------------------------------------------- |
| `postgres`      | 54321 | PostgreSQL 16 with `wal_level=logical`                |
| `electric`      | 3001  | Electric SQL (real-time sync)                         |
| `remote-api`    | 3100  | Postgres-backed API (the "cloud")                     |
| `api`           | 3002  | Local PGlite API (the "desktop", syncs to remote-api) |
| `dashboard`     | 8081  | Todo dashboard                                        |
| `landing-page`  | 8080  | Landing page                                          |
| `documentation` | 8082  | Documentation site                                    |

Run the full stack:

```bash
docker compose -f deployment/dashboard/docker-compose.yml up --build -d
```

Run just the database layer (for local development with remote backend):

```bash
docker compose -f deployment/dashboard/docker-compose.yml up -d postgres electric remote-api api
```

Stop:

```bash
docker compose -f deployment/dashboard/docker-compose.yml down
```
