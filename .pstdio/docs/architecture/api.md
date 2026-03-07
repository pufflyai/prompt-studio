# API

The pstdio API (`pstdio-api`) is the single gateway between all clients and the data layer. Every read and write — from the CLI or the dashboard — goes through it.

## Why a central API

- **One source of truth.** The API owns the database and storage. No client talks to the DB directly.
- **Shared across clients.** The CLI and dashboard hit the same endpoints, so behavior stays consistent.
- **Decoupled clients.** Clients only depend on HTTP. Swapping the database, adding caching, or changing storage is invisible to them.

## Architecture

```
┌───────────┐   ┌───────────┐   ┌───────────────┐
│    CLI    │   │   Dashboard   │
└─────┬─────┘   └───────┬───────┘
      │                 │
      └─────────────────┘
              │  HTTP
                      ▼
              ┌───────────────┐
              │   pstdio-api  │
              └───────┬───────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    ┌──────────┐ ┌─────────┐ ┌────────┐
    │ pstdio-db│ │ storage │ │ agents │
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

## Rules

1. **All client requests go through the API.** Clients must never read from or write to the database directly. File-system access for local config (`.pstdio/config.json`, `.pstdio/docs/`) is fine — persistent data is the API's job.
2. **Endpoints live under `features/<domain>/endpoints/`.** One file per endpoint, co-located with its test.
3. **Zod schemas define the contract.** Request and response shapes are validated at the boundary.
4. **The dashboard reuses the same endpoints.** If the CLI needs a new capability, add an API endpoint — the dashboard will use it too.
