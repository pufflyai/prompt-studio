# API

The pstdio API (`pstdio-api`) is the single gateway between clients and the data layer. Every durable read and write from the CLI, dashboard, future TUI, SDK consumers, and extension command adapters goes through the API service.

## Why a central API

- **One source of truth.** The API owns the database connection, storage services, domain services, extension command execution, activity, and sync emission. No client talks to the DB directly.
- **Single DB connection.** The local PGlite database is process-local and must be opened by one long-lived API service, not by each client command or UI.
- **Shared across clients.** The CLI, dashboard, and future clients hit the same endpoints, so behavior stays consistent.
- **Decoupled clients.** Clients only depend on HTTP. Swapping the database, adding caching, or changing storage is invisible to them.

## Architecture

```
┌───────────┐   ┌───────────┐   ┌───────────┐
│    CLI    │   │ Dashboard │   │ Future UI │
└─────┬─────┘   └─────┬─────┘   └─────┬─────┘
      │               │               │
      └───────────────┼───────────────┘
                      │ HTTP / SSE
                      ▼
              ┌───────────────┐
              │   pstdio-api  │
              └───────┬───────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    ┌──────────┐ ┌─────────┐ ┌────────┐
    │ pstdio-db│ │ storage │ │harness │
    └──────────┘ └─────────┘ └────────┘
```

### Health

| Method | Path     | Description              |
| ------ | -------- | ------------------------ |
| GET    | /healthz | Liveness probe           |
| GET    | /readyz  | Readiness (DB + storage) |
| GET    | /ping    | Simple ping              |

## Lifecycle

### Starting the API

The CLI auto-starts the API as a detached background process when a command needs it. There are two launch paths:

- **Workspace mode** (monorepo detected): runs `bun run start` in the `pstdio-api` package.
- **Bundled mode** (distributed CLI): runs the bundled `server.js` directly with `node`.

The `dev` script (`bun run --hot`) is reserved for interactive development only. It must never be used for background processes because `--hot` restarts the process on exit, which prevents graceful shutdown via the `/shutdown` endpoint.

### Stopping the API

`pstdio close` sends a `POST /shutdown` request. The endpoint responds with 200 and calls `process.exit(0)` after a short delay. If the API is not running, the CLI prints "API is not running." and exits normally.

## Service Layer

See [Service Layer](./service-layer.md) for the three-tier architecture (DB services, storage services, domain services) and the rules for how routes access data.

## Rules

1. **All durable state goes through the API.** Clients must never read from or write to the database directly, construct DB services, or import `pstdio-db`. File-system access for local config (`.pstdio/config.json`, `.pstdio/docs/`) and repo-context artifacts is fine; persisted project state is the API's job.
2. **Endpoints live under `features/<domain>/endpoints/`.** One file per endpoint, co-located with its test.
3. **Zod schemas define the contract.** Request and response shapes are validated at the boundary.
4. **All clients reuse the same endpoints.** If the CLI needs a new capability, add an API endpoint or SDK method so the dashboard and future clients can use the same behavior.
5. **Extension command handlers that persist data run through the API boundary.** The CLI may discover local command metadata for help, but command execution that touches project state must call the API command endpoint so `pstdio-api` remains the only DB owner.
