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

`GET /v1/sync/stream?since=<seq>` — replays missed events from the ring buffer, then switches to live streaming. Heartbeat every 30 seconds.

### Cascade deletes

Before deleting a parent row, the server walks the FK graph depth-first, emits `sync:delete` for each dependent row (children first, parent last), then executes the database delete.

### Side-effect inserts

Some mutations create implicit rows (e.g. creating a project auto-creates default statuses and tags). After the primary insert, the endpoint re-queries and emits `sync:set` for each auto-created row.

## Client

Each synced table maps to a TanStack DB `Collection`. A `fetch`-based SSE reader connects to the stream endpoint and routes events to collection writers. Auto-reconnects after 1 second with `?since=<lastSeq>`.

### Querying collections

Components read synced data with `useLiveQuery`. Every query must use the **spread pattern** in `.select()` to preserve all fields:

```ts
// Correct — spread preserves all fields
useLiveQuery((q) =>
  q.from({ t: getCollection("tickets") })
   .where(({ t }) => eq(t.project_id, projectId))
   .select(({ t }) => ({ ...t })),
  [projectId],
);

// Wrong — returning the proxy strips unaccessed fields
.select(({ t }) => t)
```

TanStack DB's query builder uses JavaScript Proxies to track property access in `.select()`. Returning the proxy directly only includes properties that were explicitly read through it. The spread operator triggers TanStack DB's internal merge mechanism that includes all fields from the source table. See [TanStack DB select proxy](/lessons-learned/tanstack_db_select_proxy) for the full story.

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
3. **Session content stays out of the stream.** Sessions reference files via `session_file_id`. Content is fetched on demand.
4. **Y.js tables are excluded.** Y.js has its own binary sync protocol.
