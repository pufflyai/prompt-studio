# API

The pstdio API (`pstdio-api`) is the gateway for core platform data and the
extension runtime. Planner ticket data is accessed through planner extension
commands executed by the API, not through core ticket REST endpoints.

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

### Runtime control

The combined runtime also exposes descriptor-authenticated lifecycle routes under `/runtime`. `/runtime/ready`
returns the protocol version and process instance identity; `/runtime/activity` reports active sessions, terminals,
and scheduled jobs; `/runtime/promote` changes desktop ownership to persistent ownership; and `/runtime/shutdown`
performs the activity-gated graceful shutdown. Every lifecycle mutation names the expected `instanceId` so a stale
client cannot act on a replacement process. `/runtime/events` announces intentional shutdown before disconnect.

### Local transport security

The runtime descriptor token is required for `/v1`, `/readyz`, and every `/runtime` route. CLI and other
non-browser clients send it as `Authorization: Bearer <token>`; the SDK reads `PSTDIO_API_TOKEN` when callers do not
pass a token explicitly. Tokens never belong in request URLs, page titles, analytics arguments, or diagnostic text.

Browser authentication uses a non-persistent `pstdio_runtime_session` cookie with `Path=/`, `HttpOnly`, and
`SameSite=Strict`. Loading dashboard HTML from the descriptor's exact origin bootstraps that cookie without placing
the bearer token in HTML or JavaScript. The authenticated browser session then carries the same cookie across REST,
SSE, and WebSocket handshakes. The `/runtime/browser-session` endpoint provides the equivalent bearer-authenticated
cookie provisioning contract for the desktop session owner.

Browser requests and credentialed CORS preflights must use the descriptor's exact
`http://127.0.0.1:<ephemeral-port>` origin. Wildcard CORS is disabled whenever runtime authentication is configured;
foreign origins receive `403`, and missing or invalid credentials receive `401`. `/healthz` and `/ping` remain public
because they expose only liveness. `/readyz` is protected because it reports backend readiness.

Runtime tokens and common credential-shaped values are redacted from structured logs, API errors, startup
diagnostics, and CLI failure records. Mutating-command analytics record the normalized command name, duration, and
result but never raw arguments.

## Lifecycle

### Starting the runtime

The shared runtime binds to `127.0.0.1` and lets the operating system select an available port. After the server is
bound and authenticated readiness succeeds, it atomically publishes `$PSTDIO_HOME/runtime.json` with mode `0600`.
The versioned descriptor contains its PID, instance ID, ownership type, exact origin, bearer token, application
version, and start time. Descriptor publication, promotion, and cleanup share a cross-process ownership lock. Promotion
and cleanup re-read the descriptor inside that lock, so a delayed process cannot overwrite or remove a replacement
runtime's descriptor.

API-backed CLI commands first validate the descriptor, PID, instance identity, and authenticated readiness. A
healthy runtime is reused even when its application version differs. A stale descriptor is reclaimed only when both
the PID and readiness probe are dead; uncertain ownership is reported instead of starting a competing PGlite owner.
When no runtime exists, compiled mode self-spawns the Bun sidecar and workspace mode runs the same combined runtime
from `packages/pstdio`. Both paths wait for the descriptor rather than parsing human-readable output.

`pst serve` starts a detached persistent runtime and returns after readiness. When it finds a desktop-owned runtime,
it promotes that process atomically without a restart or ownership demotion.

### Stopping the API

`pst close` targets the runtime in the default-home descriptor. It refuses shutdown while backend-authoritative
activity is present and prints the active work. `pst close --force` authorizes cancellation, requests the same normal
shutdown path, and waits without a timeout for both process exit and matching descriptor removal. Cleanup only
removes a descriptor whose PID and instance ID still match the exiting runtime.

## Service Layer

See [Service Layer](./service-layer.md) for the three-tier architecture (DB services, storage services, domain services) and the rules for how routes access data.

## Rules

1. **All client requests go through the API.** Clients must never read from or write to the database directly. File-system access for local config (`.pstdio/config.json`, `.pstdio/docs/`) is fine — persistent data is the API's job.
2. **Endpoints live under `features/<domain>/endpoints/`.** One file per endpoint, co-located with its test.
3. **Zod schemas define the contract.** Request and response shapes are validated at the boundary.
4. **The dashboard reuses the same core endpoints and extension commands.** If
   the CLI needs a new core capability, add an API endpoint. If it is
   planner-ticket behavior, add or reuse a planner extension command.

## Activity Endpoints

Activity endpoints return mutation events in deterministic order: `(created_at desc, id desc)`.

### Endpoints

| Method | Path                         | Description                                        |
| ------ | ---------------------------- | -------------------------------------------------- |
| GET    | /v1/projects/{id}/activity   | Project-wide activity stream with optional filters |
| GET    | /v1/workspaces/{id}/activity | Workspace activity history                         |
| GET    | /v1/sessions/{id}/activity   | Session activity history                           |

### Query Parameters

- `cursor` — pagination cursor from the previous response.
- `resource_type` — project endpoint only (`ticket`, `workspace`, `session`).
- `event_type` — filter to a single event type.
- `from` / `to` — ISO timestamps used as inclusive `created_at` bounds.
- `limit` — page size (clamped to `1..200`, defaults to `50`).

### Response Shape

```json
{
  "events": [
    {
      "id": "evt_123",
      "project_id": "proj_1",
      "resource_type": "ticket",
      "resource_id": "ticket_1",
      "event_type": "ticket_updated",
      "actor_type": "system",
      "actor_id": null,
      "source": "api",
      "summary": "Updated ticket PS-1",
      "payload_json": {},
      "created_at": "2026-04-26T00:00:00.000Z"
    }
  ],
  "next_cursor": "base64url-encoded-cursor-or-null"
}
```

### Event Taxonomy (v1)

- Workspace: `workspace_created`, `workspace_archived`, `workspace_deleted`
- Session: `session_created`, `session_status_updated`, `session_archived`

Planner ticket events are extension-owned and are not part of the core API
activity endpoint taxonomy.
