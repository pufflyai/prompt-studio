---
status: "current"
created: "2026-03-10T20:12:05Z"
---

# PRD: Real-time Updates

## Summary

Prompt Studio keeps dashboard state current by streaming database changes over SSE and applying them into TanStack DB collections in the browser.

## Problem

CLI, API, and dashboard actions all mutate the same project state. Without live sync, dashboards would quickly become stale.

## Goals

- Keep project state live without polling.
- Make the initial sync and incremental update model explicit.
- Clarify which tables participate in sync.

## Non-Goals

- Syncing large markdown blobs or binary document state through this channel.
- Mixing Y.js protocol traffic into the generic product sync stream.

## Overview

The sync model has two phases:

1. An initial `init` SSE event sends the full synced state plus the current sequence number.
2. Incremental `sync:set` and `sync:delete` events stream row-level updates after that point.

Heartbeats carry the latest sequence id to keep the connection warm.

## Requirements

### Functional Requirements

1. The dashboard must subscribe to the sync stream when the app mounts.
2. The server must send a full state snapshot on first connect.
3. Reconnecting clients must be able to resume from a known sequence id.
4. Table updates must map cleanly to TanStack DB collection writes.

### UX Requirements

- Live project changes should appear without manual refresh.
- Sync should be transparent to end users outside of load and reconnect states.

### Operational Requirements

- The sync stream must exclude Y.js tables.
- The browser should maintain one writer per synced table.

## Behavior

1. The dashboard boots a sync client from the API base URL.
2. The API returns an `init` event with the full set of synced tables and a sequence id.
3. The dashboard truncates and writes the initial rows into its local collections.
4. Later `sync:set` and `sync:delete` events update or remove rows by id.
5. Heartbeats keep the stream alive and give reconnect logic a fresh sequence cursor.

## Interface

### Synced Tables

The API sends these 11 tables:

- `board_views`
- `board_default_views`
- `settings`
- `projects`
- `installed_extension_sources`
- `notifications`
- `extension_instances`
- `sessions`
- `workspaces`
- `files`
- `workspace_sessions`

`board_default_views` rows use a derived sync ID from `boardDefaultSyncRow`.
Resource link changes travel as `resource_anchor_events` events on the same stream.
They are not a synced table and are not part of `init`.

Planner tickets, ticket statuses, ticket tags, and ticket file metadata are not
core synced tables. Dashboard ticket surfaces load planner-owned data through
planner extension commands and combine it with synced host rows such as
`workspaces`, `workspace_sessions`, and `sessions`. Planner image attachments
also stay on the extension blob path: upload/list/preview flows use extension
file ownership plus planner commands, not dashboard ticket file APIs.

The authoritative table list is [SYNCED_TABLES](../../../packages/pstdio-api/src/features/sync/get-full-state.ts).

### SSE Event Types

| Event         | Purpose                             |
| ------------- | ----------------------------------- |
| `init`        | Full state bootstrap.               |
| `sync:set`    | Insert or update one row.           |
| `sync:delete` | Delete one row.                     |
| `heartbeat`   | Keepalive plus current sequence id. |

## Rules & Constraints

- Y.js tables are intentionally excluded from this stream.
- Session content is represented by related file records instead of large inline blobs in the sync payload.
- A delete sends `sync:delete` events only after the database delete succeeds. A
  project delete first lists the synced rows that cascade from it, then sends
  their deletes children first and the project last. A missing project sends
  nothing.
- The dashboard sync provider starts automatically on app mount.

## Errors

| Error                    | Cause                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| Stale UI after reconnect | The client lost its sequence cursor or failed to replay missed events.      |
| Missing live updates     | The sync stream could not connect or the event bus did not emit the change. |

## Delivery record

Checked on 2026-10-18 against main commit `45580feb`. The newest stable release is `pstdio@0.43.1`.

| Field | Record |
| --- | --- |
| Status | Released. |
| Implementation | `packages/pstdio-api/src/features/sync/` (stream, snapshot, and cascade order) and `packages/pstdio-dashboard/src/lib/sync/`. Board views joined the stream in #845. Project delete cascades came in #922. |
| Availability | #845 shipped in `pstdio@0.39.0` and #922 in `pstdio@0.42.0`. |
| Remaining work | The dashboard's own table list in `packages/pstdio-dashboard/src/lib/sync/collections.ts` still names `templates`, which the API no longer sends. A child row created between the cascade listing and the delete would be removed without its own delete event; this is read from source and not tested. |
| Evidence | Unit tests, passed locally on 2026-10-18: `stream.p1.test.ts`, `stream-race.p0.test.ts`, and `get-full-state.p1.test.ts` in `packages/pstdio-api/src/features/sync/`, and `packages/pstdio-api/src/services/project-service.p1.test.ts` ("delete publishes every synced dependent after the rows are gone"). |
