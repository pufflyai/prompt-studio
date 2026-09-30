# Sessions

Prompt Studio tracks conversations between users and coding agents as sessions. A session captures the full lifecycle — from prompt submission through agent execution to completion or failure — and bridges the database, agent layer, API, and dashboard.

## Architecture

CLI and dashboard clients call the session API. Domain services coordinate database rows, the scheduler, workspace providers, extension harnesses, and the conversation owner. The host's sync stream carries row changes; a separate session stream carries conversation patches.

## Core concepts

### Two session IDs

Every session has two identifiers:

- `session.id` — Prompt Studio's database record for lifecycle, metadata, and cached content.
- `session.agent_session_id` — the external agent's own session/thread ID (for `opencode` or `claude-code`).

A session is associated with a workspace via the `workspace_sessions` join table. When no workspace is supplied, the server links the default workspace. Sessions resolve their local or remote execution target through that workspace. A workspace can have multiple sessions (e.g. an implementation session followed by a review session).

### Session ↔ workspace ↔ planner ticket relationship

```
planner ticket ──┐
                 │ extension-owned workspace link metadata
                 ▼
             workspace ──┐
               │         │ workspace_sessions (join)
               │         ▼
               │      session(s)
               ├── branch
               ├── root_path
               ├── anchors_json
               └── workspace_shorthand (e.g. A0001)
```

- Core workspaces are generic host rows. Planner ticket links are extension-owned metadata.
- A workspace can have many sessions via `workspace_sessions` (one-to-many).
- Multiple concurrent sessions per workspace are allowed.
- Planner ticket attempts are host workspaces plus planner-owned link/status metadata and linked sessions.

## Data model

| Data | Owner and purpose |
| --- | --- |
| `sessions` | Lifecycle, project ID, harness and provider session IDs, model, parameters, resource anchors, timestamps, and saved conversation file ID |
| `workspace_sessions` | Unique workspace/session links; a workspace can have multiple sessions |
| `session_queue_entries` | Accepted start/follow-up work ordered by identity primary key `queue_position`; multiple entries may belong to one session |
| `workspaces` | Location/provider state, capabilities, default-workspace identity, and resource anchors |
| Conversation checkpoint | Complete saved message array referenced by the session file |

A queued prompt is durable accepted work. Queue claims and status transitions must preserve run identity across retries. Queue position distinguishes identical prompts; session ID is not the queue's primary key.

The [session response schema](../../../packages/pstdio-api-contracts/src/sessions.ts) defines returned fields. Workspace information comes from workspace records and `workspace_sessions`, rather than invented response enrichment. Planner ticket data remains extension-owned. See the [queue schema](../../../packages/pstdio-db/src/db/schemas/session-queue-entries.ts).

## Session lifecycle

### Status semantics

| Status           | Meaning                                     |
| ---------------- | ------------------------------------------- |
| `queued`         | Accepted work waiting for runtime capacity  |
| `in_progress`    | Agent is actively executing                 |
| `awaiting_input` | Agent is waiting for user approval or input |
| `completed`      | Agent finished successfully                 |
| `failed`         | Agent crashed or returned non-zero exit     |
| `cancelled`      | Session was stopped by user                 |
| `disconnected`   | Server lost the process handle              |

### Status transitions

```
create / follow-up ──► queued ──► in_progress
                           │          │
                           │          ├────────────┬────────────┬────────────┐
                           │          ▼            ▼            ▼            ▼
                           │   awaiting_input  completed     failed      cancelled
                           │          │                                  (via stop)
                           │          ▼
                           └──── in_progress (on approval response)
```

- Create session → `in_progress` or `queued`, depending on runtime capacity
- Follow-up → `in_progress` or `queued`, depending on runtime capacity
- Queued session drain → `in_progress`
- Harness completes successfully → `completed`
- Harness fails → `failed`
- Approval request → `awaiting_input`
- User stop → `cancelled`; the harness owns cancellation and process cleanup
- Transport/fetch error during follow-up → `failed` + error in cached messages

## Entry points

### 1) Project session — `POST /v1/sessions`

General project chat sessions, not tied to a specific ticket.

```json
{
  "project_id": "<project-id>",
  "title": "Kickoff session",
  "prompt": "Review this project",
  "agent": "pstdio.harness-open-code.harness.opencode",
  "model": "openai/gpt-5.3-codex"
}
```

Server flow:

1. Validate workspace ownership and resolve its target.
2. Resolve agent from the request, project selection, or available harness defaults.
3. Resolve model from the request. If the request omitted both `agent` and `model`, the project default model can be used for the resolved default agent.
4. Create session with status `in_progress` when runtime capacity is available, or `queued` when capacity is full. Store the resolved request model as `last_selected_model`.
5. If `workspace_id` is provided, link session to the existing workspace. Otherwise, link the project's default workspace.
6. If queued, persist the prompt in `session_queue_entries` and return without creating an event store.
7. If started immediately, create in-memory event store for streaming.
8. Call the harness with prompt, title, model, parameters, and the resolved local or remote execution target.
9. Persist `agent_session_id` when agent session starts.
10. Track process exit to set status `completed`/`failed`/`cancelled`, push status patch, clean up stream state, and drain queued work.

### Model selection contract

`model` in a create/follow-up request is the model selected for that request. The session row stores `last_selected_model`, which is the latest selected model for the session and can change across turns.

Rules:

1. Request `model` wins.
2. If request `agent` is provided and request `model` is omitted, do not apply the project default model.
3. If request `agent` and request `model` are both omitted, the project default model can be used when it belongs to the resolved default agent.
4. Follow-up without a request `model` reuses `last_selected_model` only when the agent is unchanged.
5. Switching agents clears the previous `agent_session_id`; the new session's `last_selected_model` is the provided request model or `null`.
6. Provider adapters own provider-specific model payload translation. The session layer only passes model strings.

### 2) Planner ticket attempt — `pstdio-planner.run-attempt`

Creates one Planner-managed attempt with a host workspace and implementation
session. This is an extension command, not a core `/v1/tickets` endpoint.

Planner attempts require Git and use `pstdio.worktree` to create an isolated branch and directory under the active home's workspace root. The provider owns the exact directory and branch naming. Ordinary sessions can use the shared project folder through `pstdio.root`; that is not a Planner run-attempt mode.

`workspaces_root` resolution order:

1. `$PSTDIO_HOME/workspaces`
2. `$HOME/.pstdio/workspaces`

Set `PSTDIO_HOME` to isolate or move the whole Prompt Studio state tree, including workspaces.

Before workspace creation, Planner resolves dependency readiness and the exact
base SHA. The implementation prompt comes from the authoritative
`implement-ticket` template and includes the ticket and workspace identity. The
session carries both ticket and `planner-attempt` anchors.

The implementation agent commits its work, saves a stable change request report,
and submits the revision through `pstdio-planner.submit-change-request`. Review
sessions are separate and carry `planner-review` anchors. Their explicit verdict
is stored against that exact revision and HEAD. Generic session completion never
implies implementation or review success.

## Follow-up messages

Endpoint: `POST /v1/sessions/:session_id/follow-up`

```json
{
  "prompt": "Continue with tests",
  "agent": "pstdio.harness-claude-code.harness.claude-code",
  "model": "claude-haiku-4-5-20251001"
}
```

Server flow:

1. Load existing session.
2. Route the follow-up through the scheduler. The session becomes `in_progress` when capacity is available or `queued` when capacity is full.
3. Resolve the workspace target. Local sessions use `root_path`; remote sessions use the provider target with no local fallback.
4. Resolve the follow-up model from request `model`, or from `last_selected_model` when the agent is unchanged.
5. **Same agent:** require `agent_session_id`, recover the complete conversation through the harness, then call resume with that exact baseline length as `messageOffset`.
6. **Different agent:** update `session.agent`, clear previous `agent_session_id`, update `last_selected_model`, and start the selected harness.
7. Resume always continues from the reconciled history. Startup failures checkpoint the captured owner and mark only that run failed.

Queued follow-ups preserve the accepted prompt. Conversation hydration includes that prompt while the queued session waits, so clients can display the prompt and queued banner before the agent resumes.

## Message source of truth

GET /v1/sessions/:id/conversation reads the active run's SessionConversation. This owner applies each patch before publishing it. Its materialized array is independent of the bounded delivery log. Root replacements, including an empty array, are authoritative. Indexed patches address raw array slots; display filtering never changes those coordinates.

An entry publishes its readiness promise before asynchronous setup. GET and SSE wait for it. Resume stops the previous harness, waits for any checkpoint, closes and captures its final messages, and retries persistence before handing over. Completion and cancellation save complete captured arrays. A failed checkpoint retains the closed owner so history remains readable. Old-run cleanup uses owner identity and the existing run-start timestamp to avoid changing a later run.

The database advances the run-start timestamp on every resume and queue dispatch, even when the clock stalls or moves backward. Dispatch recovery retains the last run identity. Guarded status changes and terminal queue cleanup share one transaction, so a stale cancellation cannot remove a newer run's queued messages.

Without an active owner, one loader reads the saved session file and native transcript. Harnesses that expose getMessages must also implement recoverMessages. The harness owns provider-format comparisons; shared SDK helpers handle ordered turns and metadata.

Reconciliation always produces a history the session can continue from. The saved conversation is what the user saw, so it wins wherever both sources record the same span differently. Native history adds only what the saved side lacks: turns it is missing, messages inside a matched turn that fill a gap, and messages written after the saved conversation ends. Native text the saved turn already shows is not repeated. When the two sources order matched messages differently, the largest consistently ordered set is kept. If a harness still cannot pair the sources, the saved conversation is used; if the saved file is unreadable, native history is used. Reads never write a recovered checkpoint.

OpenCode composes full poll snapshots against the current owner synchronously after the native read. Provider messages and deletions determine the native result; host attachments and generated errors follow identifiable turns. When repeated prompts lack stable IDs, the adapter retains uncertain saved turns separately while publishing fresh provider output. It never assigns metadata to a guessed owner. Repeating the same snapshot does not add copies. See [OpenCode recovery](0002-agents.md#opencode-snapshot-recovery) for completion and warning behavior.

GET /v1/sessions/:id/conversation/sources exposes the unchanged saved and native arrays, with independent source errors, under the session's existing permissions. It is a diagnostic view; the dashboard never blocks a session on how the two sources compare.

## Streaming

### Event store (per-session, in-memory)

The bounded event store delivers patches; it is not a history database. Evicting old delivery events does not change the conversation. Snapshot capture and subscription registration are synchronous. Closing an owner rejects later patches and completes current and future subscriptions while leaving its snapshot readable.

### Session message streaming via SSE

A client holds one session stream for all the sessions it shows. Browsers allow six HTTP/1.1 connections per origin. One stream per open chat would leave too few connections for normal requests, so a client holds at most two long-lived connections: table sync and the session stream.

- `GET /v1/session-stream` opens the stream. It sends `connected` with a `connection_id`, then a `heartbeat` every 8 seconds.
- `POST /v1/session-stream/:connectionId/subscriptions` with `{ subscription_id, session_id }` starts streaming one session. The client picks the subscription ID.
- `DELETE /v1/session-stream/:connectionId/subscriptions/:subscriptionId` stops it. Closing the stream stops all its subscriptions.

Every session event carries `{ subscription_id, data }`. A subscription sends:

- ready when it starts;
- one exact root snapshot after initialization, including an empty array;
- subsequent patch and approval_request events;
- end when the run finishes without an immediate queued follow-up;
- error when the server cannot stream the session.

The SDK opens the stream for the first subscription and closes it after the last one. If the stream drops, every open subscription receives an error.

Inactive streams use the same history loader as GET and send the readable snapshot and end. A waiting reader follows a replacement owner instead of publishing an obsolete initializer's result.

The client lets the initial GET hydrate only until the first SSE snapshot. Connection generations and message revisions reject late GETs and old stream callbacks. Queued prompts are a separate overlay loaded through GET /v1/sessions/:id/queued-messages. Queue edits, removals, reorders, and claims publish the owning session row. They trigger only the queue read lane, not full transcript hydration. A changed run-start timestamp reconnects the stream, even before the previous stream ends. An active stream waits if the run status arrives before its owner is published.

The session stream publishes `queued_messages` before its first snapshot and before a newly confirmed user message. The payload identifies pending queue entries by queue position, so two identical prompts remain distinct. A newer stream queue snapshot invalidates older queue GET responses. Queue read errors retain the last pending list and do not interrupt confirmed history.

### Table sync via SSE

All session/workspace rows are synced to clients via the general-purpose SSE endpoint at `GET /v1/sync/stream`. This uses the `EventBus` which emits `set`/`delete` events with sequence numbers, allowing clients to resume with `?since={seq}`.

Session message streaming uses a separate SSE connection from table sync. Table sync handles row-level changes (status, title, timestamps), and the session stream handles message content patches.

## Diff inspection

Diffs are a workspace concern — the workspace owns the branch and worktree path.

Endpoint: `GET /v1/workspaces/:workspace_id/diff?mode=current|fork_point`

1. Resolve the selected workspace target and its declared capabilities.
2. Require Git capability only for Git operations.
3. Compute parsed file diff and totals.

Response includes `workspace_id`, `base_ref`, `head_ref`, per-file `files`, and aggregate `totals` (`additions`, `deletions`, `file_count`).

Clients that have a session can resolve the workspace through the `workspace_sessions` association and call the workspace diff endpoint directly.

## Client integration

### Table sync

The dashboard uses TanStack DB collections with the SDK SSE sync client:

- Connect to `GET /v1/sync/stream`
- Populate local collections on `init`, apply deltas on `sync:set`/`sync:delete`
- Auto-reconnect after 1 second on disconnection
- Track sequence numbers for resumption

### Session status indicator

`SessionIndicator` component renders:

- `completed` → green CircleCheck
- `failed` → red CircleAlert
- `cancelled` → yellow CircleStop
- others → gray CircleDashed

## Rules

1. **Sessions resolve a workspace through `workspace_sessions`.** When creation omits a workspace, the host links the default workspace. A workspace can have multiple sessions, and its provider capabilities determine available files and diffs.
2. **The active owner holds complete history.** Inactive reads reconcile the complete saved checkpoint with native provider history, with the saved conversation winning disagreements. Snapshot providers preserve host metadata without guessing ownership. Reconciliation never blocks a session.
3. **Event stores are ephemeral.** They live in-memory for the duration of the API process and are not persisted.
4. **All session mutations emit to EventBus.** Clients receive real-time updates via SSE sync.
5. **Follow-ups can switch agents.** When the agent changes, the previous `agent_session_id` is cleared and a new session is started with the new agent.

## Restart recovery

- Delivery logs are not persisted. Complete conversation checkpoints and provider history support recovery after API restart. Stale `in_progress` sessions are reattached when the agent supports it (OpenCode) or transitioned to `disconnected` otherwise, via the startup sweep (`runStartupTasks` → `resolveOrphanedSessions`; see [Session Status Lifecycle](0019-session-status-lifecycle.md)).
