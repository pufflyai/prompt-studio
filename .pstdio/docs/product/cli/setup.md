---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Runtime and API Setup

## Summary

This page documents runtime commands that control API/dashboard startup, shutdown, and log access: `pstdio`, `pstdio serve`, `pstdio close`, and `pstdio logs`.

## Command Summary

| Command | Purpose |
| ------- | ------- |
| `pstdio` | Ensure API is running, serve dashboard, optionally open browser. |
| `pstdio serve` | Start API + dashboard in one process (used directly and by compiled mode). |
| `pstdio close` | Stop the background API process if running. |
| `pstdio logs` | Print the tail of the runtime JSONL log file or its resolved path. |

## Behavior

## API Auto-Start Middleware

All commands except `close`, `logs`, and `serve` run through startup middleware that calls `ensureApi(...)` before command execution.

## Environment Variables

### Runtime state

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PSTDIO_HOME` | `~/.pstdio` | Root for pstdio runtime state. Default database, storage, workspaces, extensions, caches, and logs derive from this directory. |
| `PSTDIO_DB_PATH` | `$PSTDIO_HOME/pstdio.db` | Narrow database path override. Use for tests and debugging; normal dev isolation should prefer `PSTDIO_HOME`. |
| `PSTDIO_STORAGE_PATH` | `$PSTDIO_HOME/storage` | Narrow file-storage override. Use only when storage must move independently from the rest of pstdio state. |
| `PSTDIO_FILES_ROOT` | bundled/package files root | Override for packaged seed files such as built-in templates and skills. Mostly for source-tree and packaging tests. |

Workspaces always derive from `PSTDIO_HOME` as `$PSTDIO_HOME/workspaces`.

### API and dashboard startup

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PSTDIO_API_URL` | `http://localhost:19840` | API base URL used by CLI clients and SDK clients when no explicit base URL is passed. Dev scripts set this when the API runs on a non-default port. |
| `PSTDIO_API_PORT` | unset | Port forwarded to an auto-started API process as `PORT`. The `--api-port` flag sets this when neither `PSTDIO_API_URL` nor `PSTDIO_API_PORT` is already set. |
| `PSTDIO_DISABLE_API_AUTO_START` | unset | Set to `1` when another process manager already owns the API process, such as `bun run dev` or `bun run dev:isolated`. |
| `PSTDIO_DISABLE_EMBED_MANIFEST` | unset | Set to `1` in source/dev mode to skip loading the compiled embedded-assets manifest. |
| `PORT` | `19840` | API server port when running `packages/pstdio-api` directly. |
| `VITE_API_BASE_URL` | `/` in isolated dev, otherwise configured by Vite | Dashboard dev-server API base URL/proxy input. |

### API behavior

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PSTDIO_API_TOKEN` | unset | Optional bearer token required by protected API routes when set. |
| `PSTDIO_AGENTS` | `claude-code,opencode` | Comma-separated agent registry override. Tests commonly use `fake`. |
| `PSTDIO_DEFAULT_EXTENSIONS` | core skills, templates, and automation extensions | JSON array or `{ "defaultExtensions": [...] }` object installed by each extension's `pstdio.scope` and enabled for new projects. Tests can set `[]`. |
| `PSTDIO_EVENT_BUS_BUFFER_SIZE` | service default | Optional positive integer for the sync event bus replay buffer. |
| `PSTDIO_LOG_LEVEL` | `error` | Runtime log level. |
| `PSTDIO_LOG_PATH` | derived from state path | Explicit log file path. |
| `PSTDIO_LOG_TARGETS` | default file/stdout behavior | Comma-separated supplemental log targets, for example `file,stdout`. |

## `pstdio`

### Usage

```sh
pstdio [--api-port <port>] [--dashboard-port <port>] [--open-browser <boolean>]
```

### Flags

| Flag | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `--api-port` | `number` | `19840` | API server port. |
| `--dashboard-port` | `number` | `5555` | Dashboard web server port. |
| `--open-browser` | `boolean` | `true` | Open dashboard URL in default browser. |

### Output

On startup, prints dashboard and API URLs.

## `pstdio serve`

### Usage

```sh
pstdio serve [--port <port>]
```

### Flags

| Flag | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `--port` | `number` | `19840` | Server port for the combined API/dashboard process. |

## `pstdio close`

### Usage

```sh
pstdio close
```

### Behavior

- If API health check fails, prints `API is not running.` and exits successfully.
- If API is healthy, requests shutdown and prints `API stopped.`.
- If shutdown fails, prints `Failed to stop the API.` and exits with status `1`.

## `pstdio logs`

### Usage

```sh
pstdio logs [--lines <count>] [--path]
```

### Behavior

- Prints the last `--lines` entries from the resolved log file. Default: `100`.
- `--path` prints the resolved log path without reading the file.
- If the log file does not exist, the command fails with the resolved path.

## Verification & Evidence

- **Commands to run**: `sed -n '1,220p' packages/pstdio/src/index.ts`, `sed -n '1,220p' packages/pstdio/src/adapters/cli/commands/dashboard/index.ts`, `sed -n '1,200p' packages/pstdio/src/adapters/cli/commands/serve/index.ts`, `sed -n '1,200p' packages/pstdio/src/adapters/cli/commands/close.ts`, `sed -n '1,200p' packages/pstdio/src/adapters/cli/commands/logs.ts`
- **Expected evidence**: Auto-start middleware excludes `close`, `logs`, and `serve`, and all four runtime commands match documented flags/behavior.
- **Where to find artifacts**: `packages/pstdio/src/index.ts`, `packages/pstdio/src/adapters/cli/commands/dashboard/index.ts`, `packages/pstdio/src/adapters/cli/commands/serve/index.ts`, `packages/pstdio/src/adapters/cli/commands/close.ts`, `packages/pstdio/src/adapters/cli/commands/logs.ts`
