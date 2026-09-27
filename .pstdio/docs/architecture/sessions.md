# Sessions

Prompt Studio tracks conversations between users and coding agents as sessions. A session captures the full lifecycle — from prompt submission through agent execution to completion or failure — and bridges the database, agent layer, API, and dashboard.

## Architecture

```
┌───────────┐   ┌───────────┐   ┌───────────────┐
│    CLI    │   │   Dashboard   │
└─────┬─────┘   └───────┬───────┘
      │                 │
      └─────────────────┘
              │  HTTP / SSE
                      ▼
              ┌───────────────┐
              │   pstdio-api  │
              │  /v1/sessions │
              └───────┬───────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
  ┌────────────┐ ┌──────────┐ ┌──────────────┐
  │  pstdio-db │ │EventStore│ │AgentRegistry │
  │  sessions  │ │(in-memory│ │              │
  │ workspaces │ │  per-id) │ │              │
  └────────────┘ └──────────┘ └──────┬───────┘
                                     │
                                ┌────┴────┐
                                ▼         ▼
                          ┌─────────┐ ┌──────────┐
                          │ Claude  │ │ OpenCode │
                          │  Code   │ │          │
                          └─────────┘ └──────────┘
```

## Core concepts

### Two session IDs

Every session has two identifiers:

- `session.id` — Prompt Studio's database record for lifecycle, metadata, and cached content.
- `session.agent_session_id` — the external agent's own session/thread ID (for `opencode` or `claude-code`).

A session is optionally associated with a workspace via the `workspace_sessions` join table. When linked, the workspace anchors repo/worktree context. When no workspace is linked, the session runs at the project root. A workspace can have multiple sessions (e.g. an implementation session followed by a review session).

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
               ├── worktree_path
               ├── anchors_json
               └── workspace_shorthand (e.g. A0001)
```

- Core workspaces are generic host rows. Planner ticket links are extension-owned metadata.
- A workspace can have many sessions via `workspace_sessions` (one-to-many).
- Multiple concurrent sessions per workspace are allowed.
- Planner ticket attempts are host workspaces plus planner-owned link/status metadata and linked sessions.

## Data model

### `sessions` table

| Column               | Type          | Notes                                                                                         |
| -------------------- | ------------- | --------------------------------------------------------------------------------------------- |
| id                   | text PK       | Unique session identifier                                                                     |
| title                | text NOT NULL | Human-readable title                                                                          |
| status               | enum          | `queued`, `in_progress`, `awaiting_input`, `completed`, `failed`, `cancelled`, `disconnected` |
| archived             | boolean       | Soft-delete flag, default `false`                                                             |
| created              | text          | Initial creation timestamp                                                                    |
| last_request_started | text          | When last agent request began                                                                 |
| last_request_ended   | text          | When last agent request finished                                                              |
| agent                | text          | `"claude-code"` or `"opencode"`                                                               |
| last_selected_model  | text          | Latest model selected for this session (nullable)                                             |
| agent_session_id     | text          | External agent session ID (nullable)                                                          |
| session_file_id      | text FK       | Reference to `files` table for cached content                                                 |
| created_at           | text          | Row creation timestamp                                                                        |
| updated_at           | text          | Row update timestamp                                                                          |

### `workspace_sessions` table

| Column       | Type          | Notes                                         |
| ------------ | ------------- | --------------------------------------------- |
| id           | text PK       | Unique link identifier                        |
| workspace_id | text FK       | References `workspaces.id`, CASCADE on delete |
| session_id   | text FK       | References `sessions.id`, CASCADE on delete   |
| created_at   | text NOT NULL | Row creation timestamp                        |

Unique constraint on `(workspace_id, session_id)`.

### `session_queue_entries` table

| Column                 | Type          | Notes                                              |
| ---------------------- | ------------- | -------------------------------------------------- |
| session_id             | text PK/FK    | Queued session to dispatch                         |
| prompt                 | text NOT NULL | User prompt accepted for later dispatch            |
| request_kind           | text NOT NULL | `start`, `follow_up`, or ticket-attempt start kind |
| question_response_json | json          | Optional approval/question response payload        |
| dispatch_started_at    | text          | Set while the scheduler is crossing dispatch       |
| created_at             | text NOT NULL | Row creation timestamp                             |
| updated_at             | text NOT NULL | Row update timestamp                               |

`session_queue_entries` is the durable intent to start or resume work later. A `queued` session without a queue entry is invalid and should not be dispatched.

### `workspaces` table (session-relevant columns)

| Column              | Type          | Notes                                                      |
| ------------------- | ------------- | ---------------------------------------------------------- |
| id                  | text PK       | Unique workspace identifier                                |
| project_id          | text FK       | References `projects.id`                                   |
| name                | text NOT NULL | Display name (e.g. `Session 1`, `Attempt 2`)               |
| branch              | text          | Git branch name                                            |
| worktree_path       | text          | Absolute path to git worktree                              |
| is_default          | boolean       | Whether this is the default project workspace              |
| archived            | boolean       | Soft-archive flag                                          |
| initializing        | boolean       | Workspace setup is still running                           |
| setup_error         | text          | Workspace setup failure message                            |
| workspace_shorthand | text NOT NULL | Unique within project (e.g. `A0001`)                       |
| anchors_json        | json          | Extension resource anchors, such as planner ticket anchors |

### Session response enrichment

Session API responses are enriched from workspace context:

- `workspace_id`, `branch`, `worktree_path`
- Planner ticket metadata when available from workspace anchors/extension lookups.

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
- Process exit `0` → `completed`
- Process exit non-zero → `failed`
- Approval request → `awaiting_input`
- User stop → `cancelled` (graceful signal, force-kill after 30s timeout)
- Transport/fetch error during follow-up → `failed` + error in cached messages

### Completion heuristic

When a session is `in_progress`, no active event store exists, and the last message has a `step-finish` part with reason `stop`, Prompt Studio marks the session `completed`.

## Entry points

### 1) Project session — `POST /v1/sessions`

General project chat sessions, not tied to a specific ticket.

```json
{
  "project_id": "<project-id>",
  "prompt": "Kickoff session",
  "agent": "opencode",
  "branch": "main",
  "repo_id": "<repo-id>",
  "model": "openai/gpt-5.3-codex"
}
```

Server flow:

1. Validate repository/workspace context when provided.
2. Resolve agent from the request, project default, or global default (`agent_configs.is_default`).
3. Resolve model from the request. If the request omitted both `agent` and `model`, the project default model can be used for the resolved default agent.
4. Create session with status `in_progress` when runtime capacity is available, or `queued` when capacity is full. Store the resolved request model as `last_selected_model`.
5. If `workspace_id` is provided, link session to the existing workspace. Otherwise, the session has no workspace and runs at project root.
6. If queued, persist the prompt in `session_queue_entries` and return without creating an event store.
7. If started immediately, create in-memory event store for streaming.
8. Call `agent.startSession(...)` with prompt/title/model and cwd.
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

Modes:

- `worktree` (default): creates branch `workspace/<workspace_shorthand>` and a git worktree at `<workspaces_root>/<workspace_shorthand>`
- `current_branch`: reuses current repo branch/root

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
  "agent": "claude-code",
  "model": "claude-haiku-4-5-20251001"
}
```

Server flow:

1. Load existing session.
2. Route the follow-up through the scheduler. The session becomes `in_progress` when capacity is available or `queued` when capacity is full.
3. Resolve cwd: workspace root if linked (`worktree_path` first, repo path fallback), otherwise project root.
4. Resolve the follow-up model from request `model`, or from `last_selected_model` when the agent is unchanged.
5. **Same agent:** require `agent_session_id`, recover the complete conversation through the harness, then call resume with that exact baseline length as `messageOffset`.
6. **Different agent:** update `session.agent`, clear previous `agent_session_id`, update `last_selected_model`, call `agent.startSession(...)`.
7. A history conflict leaves both sources unchanged and rejects resume with 409. Other startup failures checkpoint the captured owner and mark only that run failed.

Queued follow-ups preserve the accepted prompt. Conversation hydration includes that prompt while the queued session waits, so clients can display the prompt and queued banner before the agent resumes.

## Message source of truth

GET /v1/sessions/:id/conversation reads the active run's SessionConversation. This owner applies each patch before publishing it. Its materialized array is independent of the bounded delivery log. Root replacements, including an empty array, are authoritative. Indexed patches address raw array slots; display filtering never changes those coordinates.

An entry publishes its readiness promise before asynchronous setup. GET and SSE wait for it. Resume stops the previous harness, waits for any checkpoint, closes and captures its final messages, and retries persistence before handing over. Completion and cancellation save complete captured arrays. A failed checkpoint retains the closed owner so history remains readable. Old-run cleanup uses owner identity and the existing run-start timestamp to avoid changing a later run.

The database advances the run-start timestamp on every resume and queue dispatch, even when the clock stalls or moves backward. Dispatch recovery retains the last run identity. Guarded status changes and terminal queue cleanup share one transaction, so a stale cancellation cannot remove a newer run's queued messages.

Without an active owner, one loader reads the saved session file and native transcript. Harnesses that expose getMessages must also implement recoverMessages. The harness owns provider-format comparisons; shared SDK helpers handle ordered turns and metadata. Ambiguous alignment returns a historyIssue and the readable fallback. Missing or unreadable sources are distinct from a successful empty transcript. Reads never write a recovered checkpoint.

OpenCode composes full poll snapshots against the current owner synchronously after the native read. Native turns determine membership. Attachments and locally generated errors follow surviving matched turns; deleting a turn or replacing history with [] removes that turn's metadata too.

GET /v1/sessions/:id/conversation/sources exposes the unchanged saved and native arrays, with independent source errors, under the session's existing permissions. The dashboard shows conflicts, offers downloads, and disables resume until a retry can reconcile them.

## Streaming

### Event store (per-session, in-memory)

The bounded event store delivers patches; it is not a history database. Evicting old delivery events does not change the conversation. Snapshot capture and subscription registration are synchronous. Closing an owner rejects later patches and completes current and future subscriptions while leaving its snapshot readable.

### Session message streaming via SSE

GET /v1/sessions/:id/stream sends:

- ready when connected;
- one exact root snapshot after initialization, including an empty array;
- subsequent patch and approval_request events;
- history_issue when recovery or a provider snapshot is ambiguous;
- heartbeat while waiting;
- end when the run finishes without an immediate queued follow-up.

Inactive streams use the same history loader as GET and send the readable snapshot, any issue, and end. A waiting reader follows a replacement owner instead of publishing an obsolete initializer's result.

The client lets the initial GET hydrate only until the first SSE snapshot. Connection generations and message revisions reject late GETs and old stream callbacks. Queued prompts are a separate overlay loaded through GET /v1/sessions/:id/queued-messages. Queue edits, removals, reorders, and claims publish the owning session row. They trigger only the queue read lane, not full transcript hydration. A changed run-start timestamp reconnects the stream, even before the previous stream ends. An active stream waits if the run status arrives before its owner is published.

The session stream publishes `queued_messages` before its first snapshot and before a newly confirmed user message. The payload identifies pending queue entries by queue position, so two identical prompts remain distinct. A newer stream queue snapshot invalidates older queue GET responses. Queue read errors retain the last pending list and do not interrupt confirmed history.

### Table sync via SSE

All session/workspace rows are synced to clients via the general-purpose SSE endpoint at `GET /v1/sync/stream`. This uses the `EventBus` which emits `set`/`delete` events with sequence numbers, allowing clients to resume with `?since={seq}`.

Session message streaming is a separate SSE connection from table sync — table sync handles row-level changes (status, title, timestamps), while the session stream handles the message content patches.

## Diff inspection

Diffs are a workspace concern — the workspace owns the branch and worktree path.

Endpoint: `GET /v1/workspaces/:workspace_id/diff?mode=unstaged|staged|all`

1. Use `workspace.worktree_path` if present, else repo root from project.
2. Validate git repository.
3. Compute parsed file diff and totals.

Response includes `diff_text`, per-file entries, and aggregate totals (`additions`, `deletions`, `file_count`).

Clients that have a session can resolve the workspace via `workspace.session_id` and call the workspace diff endpoint directly.

## Client integration

### Table sync

Clients (CLI, dashboard) use TanStack React-DB with SSE sync:

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

1. **Sessions optionally link to a workspace via `workspace_sessions`.** When linked, the workspace provides cwd and diff context. Without a workspace, the session runs at the project root and has no diff tracking. A workspace can have multiple sessions.
2. **The active owner holds complete history.** Inactive reads reconcile the complete saved checkpoint with native provider history. Incremental providers preserve saved turns; snapshot providers own membership. Unresolved conflicts preserve both sources and block resume.
3. **Event stores are ephemeral.** They live in-memory for the duration of the API process and are not persisted.
4. **All session mutations emit to EventBus.** Clients receive real-time updates via SSE sync.
5. **Follow-ups can switch agents.** When the agent changes, the previous `agent_session_id` is cleared and a new session is started with the new agent.

## Current gaps

- Event stores are lost on API restart — no persistence layer. Stale `in_progress` sessions are reattached when the agent supports it (OpenCode) or transitioned to `disconnected` otherwise, via the startup sweep (`runStartupTasks` → `resolveOrphanedSessions`; see [Session Status Lifecycle](/architecture/session-status-lifecycle)).
