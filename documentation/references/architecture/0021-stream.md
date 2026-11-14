# Streaming

The API streams database changes to connected clients in real time using Server-Sent Events (SSE). Mutations flow through REST endpoints; SSE is server→client only.

## Architecture

```
┌───────────┐           ┌───────────────┐
│    CLI    │           │   Dashboard   │
└─────┬─────┘           └───────┬───────┘
      │                         │
      │                    fetch + SSE
      │                         │
      │                         │
      └──── REST ────►┐◄──── ───┘
                      │
              ┌───────▼───────┐
              │   pstdio-api  │
              │  ┌──────────┐ │
              │  │ EventBus │ │
              │  └────┬─────┘ │
              │       │ emit  │
              └───────┼───────┘
                      │  SSE
         ┌────────────┼────────────┐
         ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │Dashboard │ │  other   │ │  ...     │
   └──────────┘ └──────────┘ └──────────┘
```

1. A client mutates data via a REST endpoint.
2. The endpoint writes to the database and emits an event to the **EventBus**.
3. The EventBus fans the event out to all subscribed SSE streams.
4. Each client applies the event to its local TanStack DB collection.

## Server

### EventBus

In-memory pub/sub with a monotonic sequence counter. Every event gets a `seq` number. A ring buffer (~1 000 events) enables reconnection replay.

Created once in `app.ts` and passed through `RouteDeps` to every endpoint that performs mutations.

### SSE endpoint

`GET /v1/sync/stream` — first connect sends a full-state `init` event.

`GET /v1/sync/stream?since=<seq>` — replays missed events from the ring buffer, then switches to live streaming. Heartbeat every 8-seconds.

### Cascade deletes

Before deleting a parent row, the server walks the FK graph depth-first, emits `sync:delete` for each dependent row (children first, parent last), then executes the database delete.

### Side-effect inserts

Some mutations create implicit core rows. After the primary insert, the endpoint
re-queries and emits `sync:set` for each auto-created row. Planner
ticket/status/tag data is extension-owned and is refreshed through planner
commands, not core table sync.

## Client

Each synced table maps to a TanStack DB `Collection`. A `fetch`-based SSE reader connects to the stream endpoint and routes events to collection writers. Auto-reconnects after 1 second with `?since=<lastSeq>`.

### Querying collections

Components read synced data with `useLiveQuery`. Every query must use the **spread pattern** in `.select()` to preserve all fields:

```ts
// Correct — spread preserves all fields
useLiveQuery((q) =>
  q.from({ t: getCollection("sessions") })
   .where(({ t }) => eq(t.project_id, projectId))
   .select(({ t }) => ({ ...t })),
  [projectId],
);

// Wrong — returning the proxy strips unaccessed fields
.select(({ t }) => t)
```

TanStack DB's query builder uses JavaScript Proxies to track property access in `.select()`. Returning the proxy directly only includes properties that were explicitly read through it. The spread operator triggers TanStack DB's internal merge mechanism that includes all fields from the source table. Missing fields can surface later as unrelated errors, such as date parsing receiving `undefined`.

Because all collections use a generic `SyncedRow` type (`{ id: string; [key: string]: unknown }`), the proxy-returned type loses the index signature. The `asSyncedRows()` helper casts the result back.

### Mutations

Mutations go directly to the REST API via `useMutation` + `apiRequest`. They do **not** go through TanStack DB collections. The update flow is:

1. Component calls `mutate()` which sends a REST request (POST/PATCH/DELETE).
2. The API writes to the database and emits an event to the EventBus.
3. The SSE stream delivers the event to all connected clients.
4. The collection writer updates the TanStack DB collection.
5. `useLiveQuery` re-renders components with the new data.

```
mutate() ──► REST API ──► DB + EventBus emit
                                   │
                        ┌──────────┼──────────┐
                        ▼          ▼          ▼
                   this client  client B   client C
                   (collection  (collection (collection
                    updated      updated)    updated)
                    via SSE)
```

There is no optimistic state layer — the UI updates only after the SSE event arrives. This keeps the implementation simple at the cost of a small delay (typically < 100 ms on localhost) between a mutation and its visible effect.

## Rules

1. **Endpoints emit events after mutations.** The EventBus is the single mechanism for notifying clients. No client polls for changes.
2. **Cascade deletes emit per-row events.** Clients must receive individual `sync:delete` events for every dependent row — not just the parent.
3. **Each client holds at most two long-lived HTTP event connections per runtime origin.** Browsers allow six HTTP/1.1 connections per origin. The client keeps table sync and one shared stream, `GET /v1/session-stream`, carrying all sessions, commands, text guests, and native-document observations across projects. Retained presentations add logical subscriptions, never physical event connections. Both streams send a `heartbeat` event every 8 seconds, keeping the connection alive within the Bun idle timeout (20 s).
4. **Session content stays out of the stream.** Sessions reference files via `session_file_id`. Content is fetched on demand.
5. **Planner ticket data stays out of core table sync.** Dashboard ticket views use planner commands for planner-owned data and core sync for host rows such as sessions/workspaces.
6. **Y.js tables are excluded.** Y.js has its own binary sync protocol.

### Command subscriptions

The shared `/v1/session-stream` transport also carries extension command streams. `createClient` owns one transport for both sessions and commands. A command subscription body is `{ subscription_id, command: { project_id, command_id, body } }`. Existing session subscription bodies remain valid.

Command events are `chunk`, `end`, and `error`, wrapped in `{ subscription_id, data }`. `end` contains the full command response, including emitted event IDs. Deleting a subscription or closing its connection aborts the command's signal. Commands do not resume after connection loss. See [ADR 0065](../../adrs/0065-stream-command-results-over-the-shared-client-stream.md).

### Text and native-document subscriptions

`createClient` passes the same shared transport to every live resource adapter. Text guests subscribe with `{ subscription_id, text_editing: { project_id, token } }`; the token retains its existing presentation permissions and lease. Events are `text_ready`, `text`, and `text_error`. A retrying guest rejoins on the shared transport and recovers current state and active close barriers.

Native-document watches subscribe with `{ subscription_id, native_document: { project_id, document_key, room_id } }`. The host checks the room against its project and document before observing. Events are `document`, `presence`, `end`, and `error`, with the same subscription envelope. The SDK decodes binary snapshots as before. A dropped watch rejects; its owner can observe the same room again. Cancelling a watch releases only its observation and transient presence, leaving the durable room and other subscriptions intact.

The native observer coalesces full document and presence states while writes are blocked. Closing or cancelling an observation detaches its listeners without waiting for shared socket backpressure. Text observers retain their existing distinct-event and byte bounds. Closing a guest still drains authored frames through its close barrier. A late subscription acknowledgement cannot resurrect a cancelled owner: transport removal waits for admission before deleting the subscription.

The direct native-document and text-editing HTTP stream routes remain available for existing HTTP callers and are deprecated in favor of shared subscriptions. The SDK uses shared subscriptions exclusively. Finite asset downloads are not live observations and retain their streaming response support.

### Workspace file observations

File explorers subscribe with `{ subscription_id, workspace_files: { project_id, workspace_id } }`
on the same shared transport. The host validates local file access before observing, shares
filesystem handles for the workspace, and releases them after the last logical observer leaves.
`files_ready` admits a fresh listing; `files_changed` invalidates the observed tree query.
These events carry hints only, not file bodies. Cancellation closes only this observation.
Filesystem coverage recovery follows [ADR 0140](../../adrs/0140-temporary-diff-watch-recovery.md).

### Enforcement and validation

`bun run verify:boundaries` runs [client event transport checks](../../../scripts/verify/client-event-transport.ts) over SDK, dashboard, workbench, UI, and extension sources. Only the sync/shared transport owners consume SSE; resource adapters use logical subscriptions.

Before completing a live-resource or transport change, run the [mixed-resource browser regression](../../../packages/e2e/src/ui/resource-stream-budget.p1.spec.ts). It checks actual HTTP/1.1 event responses against the overall two-connection budget with five tickets, several files, sessions, commands, late cancellation, edits at close, reconnects, and destination metadata. It also exercises retained dashboard views and project switching. See the [resource ownership lesson](../../lessons-learned/0020-resource-stream-ownership.md).
