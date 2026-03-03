# API

The pstdio API (`pstdio-api`) is the single gateway between all clients and the data layer. Every read and write — from the CLI, the TUI, or the dashboard — goes through it.

## Why a central API

- **One source of truth.** The API owns the database and storage. No client talks to the DB directly.
- **Shared across clients.** The CLI, TUI, and dashboard all hit the same endpoints, so behavior stays consistent.
- **Decoupled clients.** Clients only depend on HTTP. Swapping the database, adding caching, or changing storage is invisible to them.

## Architecture

```
┌───────────┐   ┌───────────┐   ┌───────────────┐
│    CLI    │   │    TUI    │   │   Dashboard   │
└─────┬─────┘   └─────┬─────┘   └───────┬───────┘
      │               │                 │
      └───────────────┼─────────────────┘
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

## Rules

1. **All client requests go through the API.** The CLI and TUI must never read from or write to the database directly. File-system access for local config (`.pstdio/config.json`, `.pstdio/docs/`) is fine — persistent data is the API's job.
2. **Endpoints live under `features/<domain>/endpoints/`.** One file per endpoint, co-located with its test.
3. **Zod schemas define the contract.** Request and response shapes are validated at the boundary.
4. **The dashboard reuses the same endpoints.** If the CLI needs a new capability, add an API endpoint — the dashboard will use it too.
