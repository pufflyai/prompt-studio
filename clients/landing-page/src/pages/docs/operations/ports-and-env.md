---
layout: ../../../layouts/docs-layout.astro
title: Running the local API
description: Processes, ports, environment variables, auth, and the reconnect story for the dashboard.
htmlTitle: Running the local API
htmlDescription: How the Prompt Studio API and dashboard processes run locally — ports, env vars, auth, and SSE reconnect.
section: Guide
category: Operations
categoryOrder: 7
order: 1
---

## Two processes

Prompt Studio runs two processes:

- **API** — an HTTP server on `http://localhost:19840`. Owns the database, runs hooks and schedules, and drives agents.
- **Dashboard** — a web UI on `http://localhost:5555`. A thin client of the API.

```bash
pstdio          # starts API if not running, starts dashboard, opens browser
pstdio serve    # starts API and dashboard in one foreground process
pstdio close    # hits POST /shutdown to stop the background API
```

`pstdio` returns to the shell quickly: the API runs in the background, the dashboard runs attached to the terminal. `pstdio serve` stays foreground for the whole stack (useful in CI). The API keeps running after `pstdio` exits — closing the dashboard tab does not stop active sessions.

## Default ports

| Role | Default | Override |
| --- | --- | --- |
| API | `19840` | `--api-port`, `PSTDIO_API_PORT` |
| Dashboard | `5555` | `--dashboard-port`, `PSTDIO_DASHBOARD_PORT` |

```bash
pstdio --api-port 19841 --dashboard-port 5556
pstdio serve --port 19841
```

Point the SDK at a non-default port with `baseUrl` or the `PSTDIO_API_URL` env var:

```ts
const client = createClient({ baseUrl: "http://localhost:19841" });
```

## Common environment variables

- **`PSTDIO_API_URL`** — absolute URL the CLI and SDK use to reach the API.
- **`PSTDIO_API_PORT`** — listen port for the API.
- **`PSTDIO_API_TOKEN`** — bearer token required on `/v1` when set (see below).
- **`PSTDIO_DASHBOARD_HOST`** / **`PSTDIO_DASHBOARD_PORT`** — dashboard listener.
- **`PSTDIO_DB_PATH`** — path to the SQLite database (`:memory:` for tests).
- **`PSTDIO_STORAGE_PATH`** — directory for uploaded files and artifacts.
- **`PSTDIO_WORKSPACES_DIR`** — directory where worktrees are created. Default `$HOME/.pstdio/workspaces`.
- **`PSTDIO_DISABLE_API_AUTO_START`** — don't auto-start the API from CLI commands.
- **`PSTDIO_DISABLE_EMBED_MANIFEST`** — force dev-mode dashboard serving (Vite) instead of the packaged manifest.

Full list with defaults: [Environment reference](/docs/reference/environment/).

## Authentication

The API listens on loopback by default and does **not** require a token. Health routes (`/healthz`, `/readyz`, `/ping`, `/openapi.json`, `/docs`, `/shutdown`) are always unauthenticated.

Enable token auth by setting `PSTDIO_API_TOKEN`:

```bash
PSTDIO_API_TOKEN="$(openssl rand -hex 32)" pstdio serve
```

When the token is set, every `/v1` request needs the bearer header:

```bash
curl http://localhost:19840/v1/projects \
  --header "Authorization: Bearer $PSTDIO_API_TOKEN"
```

Pass it to the SDK the same way:

```ts
const client = createClient({
  baseUrl: process.env.PSTDIO_API_URL,
  token: process.env.PSTDIO_API_TOKEN,
});
```

Keep the token in your shell environment, a `.env` file, or your OS keychain — **do not commit it to `.pstdio/config.json`**. Enable auth when the API is exposed beyond loopback (reverse proxy, remote teammate, or other local users you don't trust).

## Reconnect and live sync

The dashboard subscribes to `GET /sync/stream` (SSE) for ticket/session/workspace changes and to `GET /v1/sessions/{id}/stream` for live session output. If the stream drops — laptop sleep, API restart, network glitch — the dashboard shows a "reconnecting" banner, retries with backoff, and re-fetches project state on reconnect. No state is lost: the database is the source of truth.

If a view appears stuck after an API restart, reload the tab. To debug streams directly:

```bash
curl -N http://localhost:19840/sync/stream
```

## Packaged vs dev

- The packaged `pstdio` binary ships a bundled dashboard (`PSTDIO_DISABLE_EMBED_MANIFEST=0`, default).
- In dev, `pstdio` runs the dashboard through Vite. Set `PSTDIO_DISABLE_EMBED_MANIFEST=1` to force dev-style serving.

## Related pages

- [Environment reference](/docs/reference/environment/) — every variable with defaults.
- [Cleanup and recovery](/docs/operations/cleanup-and-recovery/) — stuck worktrees, drifted state, recovery.
- [`pstdio serve` reference](/docs/reference/cli/global/#pstdio-serve).
