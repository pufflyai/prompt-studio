---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Real-time Updates

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

- `projects`
- `repos`
- `project_repos`
- `agent_configs`
- `ticket_statuses`
- `tickets`
- `ticket_tags`
- `ticket_tag_assignments`
- `sessions`
- `workspaces`
- `ticket_workspaces`
- `files`
- `ticket_files`
- `workspace_artifacts`
- `templates`

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
- The dashboard sync provider starts automatically on app mount.

## Errors

| Error                    | Cause                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| Stale UI after reconnect | The client lost its sequence cursor or failed to replay missed events.      |
| Missing live updates     | The sync stream could not connect or the event bus did not emit the change. |
