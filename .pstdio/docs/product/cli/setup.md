---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Runtime and API Setup

## Summary

This page documents runtime commands that control API/dashboard startup, shutdown, and log access: `pst`, `pst serve`, `pst close`, and `pst logs`.

## Command Summary

| Command | Purpose |
| ------- | ------- |
| `pst` | Ensure the shared runtime is running, serve the dashboard, and optionally open a browser. |
| `pst serve` | Start or promote the detached persistent API + dashboard runtime. |
| `pst close` | Gracefully stop the descriptor runtime, subject to its activity gate. |
| `pst logs` | Print the tail of the runtime JSONL log file or its resolved path. |

## Behavior

## API Auto-Start Middleware

All API-backed commands except `close`, `logs`, and `serve` run through startup middleware before command execution.
Unless an explicit API URL or port is supplied, the middleware discovers `$PSTDIO_HOME/runtime.json`, validates its
PID and authenticated instance identity, and publishes its ephemeral origin to later CLI clients.

Auto-started runtime processes are detached from the invoking command and do not retain its terminal streams. The
middleware waits for the protected descriptor and authenticated readiness. A descriptor is reclaimed only after both
its PID and readiness probe fail, preserving the PGlite single-owner lock as the final concurrent-start guard.

If an auto-started process exits before becoming healthy, the CLI reports its exit code or signal. If it remains unhealthy for 15 seconds, the middleware terminates that unsuccessful process and reports matching startup diagnostics plus the resolved log path.

## Environment Variables

### Runtime state

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PSTDIO_HOME` | `~/.pstdio` | Root for Prompt Studio runtime state. Default database, storage, workspaces, extensions, caches, and logs derive from this directory. |
| `PSTDIO_DB_PATH` | `$PSTDIO_HOME/pstdio.db` | Narrow database path override. Use for tests and debugging; normal dev isolation should prefer `PSTDIO_HOME`. |
| `PSTDIO_STORAGE_PATH` | `$PSTDIO_HOME/storage` | Narrow file-storage override. Use only when storage must move independently from the rest of Prompt Studio state. |
| `PSTDIO_FILES_ROOT` | bundled/package files root | Override for packaged seed files such as built-in templates and skills. Mostly for source-tree and packaging tests. |

Workspaces always derive from `PSTDIO_HOME` as `$PSTDIO_HOME/workspaces`.

### API and dashboard startup

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PSTDIO_API_URL` | discovered runtime origin | Explicit API base URL override. Normally the CLI sets this from the validated runtime descriptor. Dashboard dev and preview servers use it as their API proxy target when set. |
| `PSTDIO_API_PORT` | unset (`0` for descriptor startup) | Explicit port for an auto-started sidecar. Port `0` lets the operating system select an available port. |
| `PSTDIO_DISABLE_API_AUTO_START` | unset | Set to `1` when another process manager already owns the API process, such as `bun run dev` or `bun run dev:isolated`. |
| `PSTDIO_DISABLE_EMBED_MANIFEST` | unset | Set to `1` in source/dev mode to skip loading the compiled embedded-assets manifest. |
| `PORT` | `19840` | API server port when running `packages/pstdio-api` directly. |

### API behavior

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PSTDIO_API_TOKEN` | discovered descriptor token | Bearer token published for authenticated runtime-control requests. |
| `PSTDIO_AGENTS` | `claude-code,opencode` | Comma-separated agent registry override. Tests commonly use `fake`. |
| `PSTDIO_DEFAULT_EXTENSIONS` | core skills, templates, and automation extensions | JSON array or `{ "defaultExtensions": [...] }` object installed by each extension's `pstdio.scope` and enabled for new projects. Tests can set `[]`. |
| `PSTDIO_EVENT_BUS_BUFFER_SIZE` | service default | Optional positive integer for the sync event bus replay buffer. |
| `PSTDIO_LOG_LEVEL` | `error` | Runtime log level. |
| `PSTDIO_LOG_PATH` | derived from state path | Explicit log file path. |
| `PSTDIO_LOG_TARGETS` | default file/stdout behavior | Comma-separated supplemental log targets, for example `file,stdout`. |

## `pst`

### Usage

```sh
pst [--api-port <port>] [--dashboard-port <port>] [--open-browser <boolean>]
```

The command discovers or starts the shared runtime. Compiled mode opens the dashboard at the descriptor origin;
workspace mode serves the development dashboard separately.

### Output

Prints the dashboard and API URLs.

## `pst serve`

### Usage

```sh
pst serve [--port <port>]
```

### Flags

| Flag | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `--port` | `number` | `0` | Server port for the combined runtime; `0` selects an available port. |

The command returns after readiness. It attaches to an existing persistent runtime or atomically promotes an existing
desktop-owned runtime without restarting it.

## `pst close`

### Usage

```sh
pst close [--force]
```

### Behavior

- If no descriptor runtime is running, prints `Runtime is not running.` and exits successfully.
- Without `--force`, active sessions, terminals, or jobs are listed and shutdown is refused with a non-zero result.
- `--force` authorizes active-work cancellation, then waits without a timeout for normal exit and descriptor cleanup.

## `pst logs`

### Usage

```sh
pst logs [--lines <count>] [--path]
```

### Behavior

- Prints the last `--lines` entries from the resolved log file. Default: `100`.
- `--path` prints the resolved log path without reading the file.
- If the log file does not exist, the command fails with the resolved path.

## Verification & Evidence

- **Commands to run**: `sed -n '1,220p' packages/pstdio/src/index.ts`, `sed -n '1,220p' packages/pstdio/src/adapters/cli/commands/dashboard/index.ts`, `sed -n '1,200p' packages/pstdio/src/adapters/cli/commands/serve/index.ts`, `sed -n '1,200p' packages/pstdio/src/adapters/cli/commands/close.ts`, `sed -n '1,200p' packages/pstdio/src/adapters/cli/commands/logs.ts`
- **Expected evidence**: Auto-start middleware excludes `close`, `logs`, and `serve`; all four runtime commands match documented behavior.
- **Where to find artifacts**: `packages/pstdio/src/index.ts`, `packages/pstdio/src/adapters/cli/commands/dashboard/index.ts`, `packages/pstdio/src/adapters/cli/commands/serve/index.ts`, `packages/pstdio/src/adapters/cli/commands/close.ts`, `packages/pstdio/src/adapters/cli/commands/logs.ts`
