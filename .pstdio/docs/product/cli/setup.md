---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Runtime and API Setup

## Summary

This page documents runtime commands that control API/dashboard startup and shutdown: `pstdio`, `pstdio serve`, and `pstdio close`.

## Command Summary

| Command | Purpose |
| ------- | ------- |
| `pstdio` | Ensure API is running, serve dashboard, optionally open browser. |
| `pstdio serve` | Start API + dashboard in one process (used directly and by compiled mode). |
| `pstdio close` | Stop the background API process if running. |

## Behavior

## API Auto-Start Middleware

All commands except `close` and `serve` run through startup middleware that calls `ensureApi(...)` before command execution.

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

## Verification & Evidence

- **Commands to run**: `sed -n '1,220p' packages/pstdio/src/index.ts`, `sed -n '1,220p' packages/pstdio/src/adapters/cli/commands/dashboard/index.ts`, `sed -n '1,200p' packages/pstdio/src/adapters/cli/commands/serve/index.ts`, `sed -n '1,200p' packages/pstdio/src/adapters/cli/commands/close.ts`
- **Expected evidence**: Auto-start middleware excludes `close` and `serve`, and all three runtime commands match documented flags/behavior.
- **Where to find artifacts**: `packages/pstdio/src/index.ts`, `packages/pstdio/src/adapters/cli/commands/dashboard/index.ts`, `packages/pstdio/src/adapters/cli/commands/serve/index.ts`, `packages/pstdio/src/adapters/cli/commands/close.ts`
