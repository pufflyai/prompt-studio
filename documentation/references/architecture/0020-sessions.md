# Sessions

Prompt Studio tracks conversations between users and coding agents as sessions. A session captures the full lifecycle — from prompt submission through agent execution to completion or failure — and bridges the database, agent layer, API, and dashboard.

## Architecture

CLI and dashboard clients call the session API. Domain services coordinate database rows, the scheduler, workspace providers, extension harnesses, and the conversation owner. The host's sync stream carries row changes; a separate session stream carries conversation patches.

## Personal history across devices

For a cloud project, each device publishes its workspace summaries, session records, and full harness-neutral conversations to the user's personal space. The index is one CRDT document. Each transcript is a separate document. These use the existing encrypted document protocol, latest-state repair, and quarantine handling, with the personal-space key from the account manager. The relay cannot read their content.

The local CRDT store retains downloaded history. The session and workspace read APIs, extension read APIs, and dashboard sync snapshot include the user's other devices. A downloaded conversation stays readable after its source stops and after the reader restarts offline. Signing out hides cached personal records; another account uses a separate local namespace. Local publication records their first account owner so changing accounts does not republish already-owned local records to a different personal space.

Synced records include `device: { ownerId, id, name }`. They stay separate from local execution rows. The scheduler, startup recovery, workspace providers, and mutation endpoints only use local rows. Reading a foreign-device session never starts a local harness or resolves its source path on this device. The dashboard shows the device and a read-only composer. Remote commands are a separate feature.

A project-key document holds shared workspace/session pointers. Each pointer contains only the resource type, opaque ID, owner ID, device ID, and device name. Shared resource anchors receive that device information without private labels, paths, or conversation content. Other project members cannot open the personal record or decrypt its transcript.

Implementation: [personal history](../../../packages/pstdio-api/src/services/personal-history/service.ts), [publication](../../../packages/pstdio-api/src/services/relay/personal.ts), and [encrypted document sync](../../../packages/pstdio-sync/src/relay/document-sync.ts).

## Core concepts

### Idle resources

The host keeps a harness's idle session resources while that conversation is open in any connected tab, while a run or native command is active, and for 30 minutes after its last use. Inactive tabs on another page or mode count as open while a connected client claims them. A layout saved on disk or an entry in session history does not retain resources by itself. After an app reload, the connected client restores interest for the tabs it restores as open.

Closing the last tab starts a 30-minute grace period. An unexpected client disconnect releases that client's interest; another window can still retain the conversation. The grace period starts after the last client's interest or active work ends, whichever happens later.

The workbench keeps a recently closed view for the same grace period, preserving its reading position and local input when reopened. Closed session views stop native command polling immediately, so background reads do not prolong native resource retention. After the grace period, the workbench unmounts the closed view. Open inactive tabs remain mounted.

The SDK client exposes `sessions.retainResources(sessionId)`, which returns a connection with `close()`. It uses the existing multiplexed session stream and restores interest after connection loss. Definitive HTTP rejections, including a deleted session's 404, stop retries and require no compensating DELETE. Network failures, server errors, timeouts, and rate limits remain retryable. A missing stream has a separate error code and reconnects the shared transport. History reads stay separate: listing sessions or reading a completed transcript does not start its native tools.

The workbench restores its open-placement inventory once and updates only the scopes whose tabs change. Regions and conversation views share a cached placement-ID set, so checking whether a tab is open does not enumerate storage or rebuild the inventory. Persistence adapters can publish layout changes, including transforms and evictions, through `onDidChangeLayout`. Navigation keeps inactive open tabs retained; closing a tab removes its interest when no other owner keeps it open.

Page Main trays start from the page declarations and routed resource. A page-specific layout snapshot is saved only when its tabs, order, pinning, or selection differ from that baseline. Returning to baseline removes the saved override when the persistence adapter supports deletion. The current layout owns default tabs; visiting a default page does not create an additional inventory owner after its tab is replaced. Explicitly opened tabs remain retained across navigation and reload until closed. Custom trays and explicit closed default panels still restore their saved state. Main geometry remains owned by the mode.

The host indexes idle owners by cleanup deadline and session ID. Retaining or using one session updates only that session's owners and the next cleanup deadline. One timer serves all idle owners. Cleanup does not scan every session on each interaction.

Resolving the selected session uses its keyed synced row and checks the selected project. It does not rebuild or sort the session list during navigation.

Session lists share a sorted snapshot per runtime collection owner, project, and the individual revisions of sessions, workspaces, and workspace-session links. Changes to unrelated synced tables and sync-readiness notifications reuse the snapshot. Edits, snapshots, and removals in the three source tables invalidate it. Switching API clients cannot reuse another runtime's session data.

Tree previews preserve an unchanged data snapshot during selection changes, so selecting a session does not clone every saved row. A failed subscription response triggers removal of the possibly accepted claim before tab interest retries.

The fixed 10,000-session bookkeeping workloads can be measured with `bun run --cwd packages/pstdio-workbench bench:open-resources` and `bun run --cwd packages/pstdio-api-runtime-host bench:session-resources`. They report restoration, warm inventory checks, bulk interest changes, and expiry separately. These workloads measure metadata and ownership; they do not start 10,000 native runtimes or mount 10,000 transcripts.

Harnesses can implement the optional `releaseSession(ctx, { sessionId })` method. The host calls it only after the grace period and waits for in-flight cleanup before dispatching another operation for that owner. Returning `false` means native work or delivery is not yet safe to release; the host keeps ownership and checks again after another grace period. A cleanup error is logged and also keeps ownership. Providers without the method retain their existing lifecycle.

The core host owns the shared retention policy. Each harness extension owns the native mechanism that makes release safe:

| Concern | Core host | Harness extension |
| --- | --- | --- |
| Retention | Count open-tab interest across connected clients and apply the 30-minute grace period. | Use the host's release request for native resources. |
| Active work | Retain host runs and commands until they settle. | Protect native turns, goals, tools, pending approvals and questions, and uncertain delivery. Defer cleanup when safety is unknown. |
| Release | Request cleanup for one eligible session and serialize it with later operations. | Release that session's idle owners through the native lifecycle. Preserve shared resources needed by other sessions and leave remote work running. |
| Recovery | Preserve the session record, transcript, drafts, and provider session identity. | Recreate resources and resume the saved native conversation on the next operation. |

These rules apply across harnesses. Releasing native resources requires each harness to support the contract; a harness that already exits after every turn may have nothing extra to release. Remote harnesses can release local connections while remote execution continues. This contract covers session resources, not unrelated services owned by other extensions.

Resource release preserves the session record, transcript, drafts, and native identity. A later follow-up recreates the runtime. Volatile JavaScript variables and background shell state do not survive an expired runtime. See [ADR 0064](../../adrs/0064-codex-app-server-runtime.md).

### Two session IDs

Every session has two identifiers:

- `session.id` — Prompt Studio's database record for lifecycle, metadata, and cached content.
- `session.agent_session_id` — the external agent's own session/thread ID (for Codex, OpenCode, or Claude Code).

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

## Session management

Saved sessions have shared Rename, Archive, and Delete commands on their breadcrumb and navigation rows. Commands use the explicit session ID or the row or tab context before the active session. Drafts have no saved-session actions.

Rename trims the name and uses `PATCH /v1/sessions/{id}/title`. Archive keeps the conversation, cancels queued work, and allows live work to continue. Both operations update the synced session row.

`DELETE /v1/sessions/{id}` returns 204 after deleting an inactive session. It returns 404 when the session is missing and 409 when active, queued, dispatching, or retained run work prevents deletion. The SDK exposes the same operation as `client.sessions.delete(id)`. Deletion shares the scheduler lock and locks the database row before checking eligibility.

Deletion removes workspace joins and incoming and outgoing resource anchors in one transaction. It publishes synced removals, refreshed surviving anchor sources, and a resource removal event after commit. A checkpoint is removed through the file service only when its `session_messages` kind and database references prove exclusive ownership. Shared checkpoints, attachments, workspace files, linked resources, and external agent history are kept. Storage read or removal errors roll back database removal; a failed database commit restores removed checkpoint bytes.

Archive and delete close only the affected session's saved views and selection. Its routed page returns to Sessions. The workbench previews direct changes while saving and restores failed previews. Dialog failures appear inline and can be retried.

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
| `awaiting_input` | Agent asked the person a question and waits |
| `completed`      | No turn is pending, or the agent finished successfully |
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
                           └──── in_progress (on answer)
```

- Create session without a prompt or attachments → inactive `completed`
- Create session with a prompt or attachments → `in_progress` or `queued`, depending on runtime capacity
- Follow-up → `in_progress` or `queued`, depending on runtime capacity
- Queued session drain → `in_progress`
- Harness completes successfully → `completed`

- Harness fails → `failed`
- Harness asks the person a question → `awaiting_input`; the answer returns it to `in_progress`
- User stop → `cancelled`; the harness owns cancellation and process cleanup
- Archive of a queued session → `cancelled`, then archived; workspace archive or delete → `cancelled` for each active session (see [session status lifecycle](0019-session-status-lifecycle.md))
- Transport/fetch error during follow-up → `failed` + error in cached messages

Creating a session without a prompt, or with a blank prompt and no attachments, leaves it idle. This applies to `POST /v1/sessions` and `ctx.sessions.create`. The scheduler creates the row and workspace link without reserving runtime capacity, creating queued work, or calling the harness. The row uses `completed`, as other sessions with no pending turn do. Both request timestamps and `agent_session_id` stay null because no turn has started.

The first message uses the normal follow-up API. With no `agent_session_id`, the scheduler calls `harness.start`. Runtime capacity still controls whether that message starts immediately or waits in the queue. A create call with attachments starts a turn even without prompt text. Native operations keep their own execution path.

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

The dashboard restores harness parameters from the session's `params_json` alongside its agent and model. Unrelated sync updates keep unsent parameter picks. For a new conversation, the project-local recent harness selection remembers explicit parameters with the agent and model. Parameters are checked against the selected model's schema once its catalog is loaded. Resetting a parameter sends its default value explicitly, so the server can replace the previous saved value.

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

The dashboard uses one transcript source at a time. Active sessions load the stream's initial snapshot and subsequent patches, without a competing conversation GET or an extra GET after a complete stream ends. Inactive sessions use the conversation GET. Recently loaded inactive history belongs to a cache scoped to the API client. Its version uses the synced session's update time, status, and request start/end times. Reopening an unchanged session reuses that history before the first paint. A changed version or explicit retry reads fresh history. The query-cache lifecycle retains history while a view uses it and removes it five minutes after its last view closes. Connection generations and message revisions reject obsolete reads and stream callbacks. A stream failure preserves displayed content but prevents partial history from entering the completed-history cache.

Queued prompts are a separate overlay loaded through GET /v1/sessions/:id/queued-messages. Queue edits, removals, reorders, and claims publish the owning session row. While a session stream is live, it carries those queue changes itself. After the stream ends, a session row event refreshes the queue; a changed inactive history version refreshes its transcript too. A changed run-start timestamp reconnects the stream, even before the previous stream ends. An active stream waits if the run status arrives before its owner is published.

The session stream publishes `queued_messages` before its first snapshot, before a newly confirmed user message, and after every session row event for that session. Because every queue change publishes its session row, the stream carries queue changes even while it waits for a run. Snapshots go out one at a time; changes during a send cause one more send. The payload identifies pending queue entries by queue position, so two identical prompts remain distinct. Queue GET responses and stream snapshots are both queue snapshots. A newer stream queue snapshot invalidates older queue GET responses. Queue read errors retain the last pending list and do not interrupt confirmed history.

A follow-up that the server queues does not reconnect the stream, because only the queue changed. The client keeps the sent message in the queue list until a queue snapshot shows the returned queue position. If the queue read started after the answer no longer lists that position, the message already left the queue, and the client drops its copy. A message that runs before any snapshot shows it stays until the conversation shows it and a new run has started.

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

## Native harness operations

Optional [harness commands and modes](../extensions/0015-harness-commands.md) use the same session, workspace, execution slot, conversation, cancellation, and checkpoint owners as normal turns. Native state remains in the provider. Existing session parameters store planning selections. A native acknowledgement does not finish an operation; its terminal event does.

## Live input from the queue

Queued input owns its execution settings. Selecting another model for the normal draft does not change saved work. Editing a request saves its full prompt, model, parameters, and attachments without starting a run.

Steering captures the running handle and uses its optional native live-input method. It keeps the current run and status, and waits for provider acceptance before promoting the request into persisted history. Completion waits for existing controls; cancellation aborts them. Unknown delivery remains recoverable and excluded from automatic queue dispatch. See [session queue ownership](0018-session-queue.md#saved-requests-and-explicit-live-input).
