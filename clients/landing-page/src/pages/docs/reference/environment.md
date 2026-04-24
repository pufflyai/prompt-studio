---
layout: ../../../layouts/docs-layout.astro
title: Environment variables
description: Every environment variable Prompt Studio reads, with defaults and purpose.
htmlTitle: Environment variables
htmlDescription: Every environment variable Prompt Studio reads, with defaults and purpose.
section: References
category: Environment
categoryOrder: 6
order: 1
---

## Runtime

### `PSTDIO_API_URL`

Absolute URL the CLI and SDK use to reach the API. Defaults to `http://localhost:19840`. Used by:

- The CLI when deciding where to send HTTP requests.
- The SDK's `createClient()` as the `baseUrl` default.

### `PSTDIO_API_PORT`

Listen port for the API process. Defaults to `19840`. Overridden by `--api-port` on `pstdio` / `--port` on `pstdio serve`.

### `PSTDIO_API_TOKEN`

Bearer token required on `/v1` requests. When unset, the API runs without auth (local-dev default). When set, the CLI, SDK, and dashboard all need the same token. See [Authentication](/docs/operations/ports-and-env/#authentication).

### `PSTDIO_DASHBOARD_HOST`

Host the dashboard listens on. Defaults to `localhost`.

### `PSTDIO_DASHBOARD_PORT`

Listen port for the dashboard. Defaults to `5555`. Overridden by `--dashboard-port`.

### `PSTDIO_DB_PATH`

Filesystem path to the SQLite database. Defaults to a per-user path in Prompt Studio's storage folder. `:memory:` for tests.

### `PSTDIO_STORAGE_PATH`

Directory for uploaded files and on-disk artifacts. Must be writable by the API process.

### `PSTDIO_WORKSPACES_DIR`

Directory under which worktree-mode workspaces are created. Defaults to `$HOME/.pstdio/workspaces`.

## CLI behavior

### `PSTDIO_DISABLE_API_AUTO_START`

When set to `1`, CLI commands assume the API is already running and never auto-start it. Useful in CI and packaging tests.

### `PSTDIO_DISABLE_EMBED_MANIFEST`

When set to `1`, the CLI serves the dashboard through Vite (dev mode) instead of the bundled manifest. Default in the packaged binary is `0`.

### `PSTDIO_PROJECT_ID`

Override for the project id when no `--project-id` is passed and `.pstdio/config.json` is missing.

## API contracts

### `PSTDIO_EVENT_BUS_BUFFER_SIZE`

Max buffered events per subscriber on the in-memory event bus. Raise it if subscribers see "slow consumer" warnings.

### `PSTDIO_FILES_ROOT`

Override for the bundled files root (`packages/pstdio/files`). Used by the e2e suite to point the API at a custom templates/plugins directory.

### `PSTDIO_AGENTS`

Comma-separated list of agents enabled by the API process. Used by tests to swap in the `fake` agent. Production deployments normally leave this unset and let the API infer from installed agents.

## Dashboard (dev)

### `VITE_API_BASE_URL`

During dashboard dev (`vite`), points the UI at a non-default API URL. Ignored by the packaged dashboard.

## Related pages

- [Running the local API](/docs/operations/ports-and-env/) — processes, ports, auth, and reconnect behavior.
- [Cleanup and recovery](/docs/operations/cleanup-and-recovery/).
