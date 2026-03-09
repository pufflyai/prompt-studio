# Streaming

The API streams database changes to connected clients in real time using Server-Sent Events (SSE). Mutations flow through REST endpoints; SSE is server→client only.

## Architecture

```
┌───────────┐           ┌───────────────┐
│    CLI    │           │   Dashboard   │
└─────┬─────┘           └───────┬───────┘
      │                         │
      │                    EventSource
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

Each synced table maps to a TanStack DB `Collection`. An `EventSource` connection routes SSE events to collection writers. Auto-reconnects after 1 second with `?since=<lastSeq>`.

### Two-layer state model (Tanstack DB)

Each collection maintains two separate layers of state:

- **Synced data.** Immutable rows written by the sync stream. The collection's `sync` callback receives SSE events and writes them here.
- **Optimistic state.** Pending local mutations not yet confirmed by the server. Applied as an overlay on top of synced data.

`useLiveQuery` merges both layers into a single view. Components always see the combined result — they do not need to know which layer a row came from.

### Optimistic mutations

Collections define `onInsert`, `onUpdate`, and `onDelete` handlers that persist changes to the API. Mutations go through the collection, not directly to REST:

1. **Mutate the collection.** Call `collection.insert()`, `collection.update()`, or `collection.delete()`. The change is added to the optimistic state layer. `useLiveQuery` immediately reflects it in the merged view.
2. **Handler persists to API.** The collection's `onInsert`/`onUpdate`/`onDelete` handler fires and sends the mutation to the REST endpoint.
3. **Success.** The handler resolves. The server emits the change via SSE, which updates the synced data layer. The optimistic entry is dropped — the synced data now contains the confirmed row.
4. **Failure.** The handler throws. The optimistic entry is removed and the merged view reverts to the synced data layer. No manual rollback needed.

```
collection.update()
  │
  ├──► optimistic state (instant, visible via useLiveQuery)
  │
  └──► onUpdate handler ──► API ──► DB + EventBus emit
                                          │
                               ┌──────────┼──────────┐
                               ▼          ▼          ▼
                          this client  client B   client C
                          (synced      (synced     (synced
                           data         data        data
                           replaces     updated)    updated)
                           optimistic
                           overlay)
```

## Rules

1. **Endpoints emit events after mutations.** The EventBus is the single mechanism for notifying clients. No client polls for changes.
2. **Cascade deletes emit per-row events.** Clients must receive individual `sync:delete` events for every dependent row — not just the parent.
3. **Session content stays out of the stream.** Sessions reference files via `session_file_id`. Content is fetched on demand.
4. **Y.js tables are excluded.** Y.js has its own binary sync protocol.
