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

Creates a host workspace + session for a planner ticket and starts the agent.
This is an extension command, not a core `/v1/tickets` endpoint.

Modes:

- `worktree` (default): creates branch `workspace/<workspace_shorthand>` and a git worktree at `<workspaces_root>/<workspace_shorthand>`
- `current_branch`: reuses current repo branch/root

`workspaces_root` resolution order:

1. `$PSTDIO_HOME/workspaces`
2. `$HOME/.pstdio/workspaces`

Set `PSTDIO_HOME` to isolate or move the whole Prompt Studio state tree, including workspaces.

Prompt resolution order:

1. explicit request `prompt`
2. planner ticket content
3. planner ticket title/shorthand fallback

The command creates a generic host workspace anchored to the planner ticket,
stores the ticket-workspace relationship in planner storage, and creates a
linked session. Workspace setup must succeed before any session is created or
queued. When a session is accepted, the API emits core `sessions` and
`workspaces` sync updates and either starts the agent in the resolved cwd or
returns `queued` for later scheduler dispatch.

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
5. **Same agent:** require `agent_session_id`, call `agent.resumeSession(...)` with `messageOffset` from cached message count.
6. **Different agent:** update `session.agent`, clear previous `agent_session_id`, update `last_selected_model`, call `agent.startSession(...)`.
7. On errors: append assistant error text to cached messages and set status `failed`.

Queued follow-ups preserve the accepted prompt. Conversation hydration includes that prompt while the queued session waits, so clients can display the prompt and queued banner before the agent resumes.

## Message source of truth

Endpoint: `GET /v1/sessions/:session_id`

Resolution strategy:

1. Try `agent.getMessages(agent_session_id, { cwd })`.
2. If successful: return normalized messages, persist to `session.content`, mark `agent_session_status = connected`.
3. If agent fetch fails: fallback to cached `session.content.messages`, mark `agent_session_status = disconnected`.
4. If no `agent_session_id`: status is `not_connected`.

## Streaming

### Event store (per-session, in-memory)

Each active session has one event store, keyed by `session.id`:

```typescript
type EventStore = {
  push(patch: JsonPatch): void;
  getHistory(): JsonPatch[];
  subscribe(): AsyncIterable<JsonPatch>;
  historyPlusStream(): AsyncIterable<JsonPatch>;
};
```

- Memory-bounded (default ~50 MB) with LRU eviction of oldest patches.
- Uses Node.js EventEmitter for subscribers (up to 100 listeners).
- `historyPlusStream()` replays buffered patches first, then streams live updates.
- Creating a new event store for the same session ID closes/replaces the old one.

### Session message streaming via SSE

Endpoint: `GET /v1/sessions/:session_id/stream`

Uses the same SSE pattern as the rest of the application. The server replays buffered patches from the event store, then streams live updates.

Events:

- `ready` — connection established (`{ sessionId }`)
- `patch` — JSON patch for message updates (`{ op, path, value }`)
- `approval_request` — agent requests tool permission (`{ id, toolName, toolInput, toolUseId }`)
- `heartbeat` — keep-alive

Approval responses are sent via a separate POST endpoint:

- `POST /v1/sessions/:session_id/approve` — `{ id, decision: "approve" | "deny" }`

If no active event store exists for the session, the server sends `ready` followed by an `end` event and closes the connection.

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
2. **Agent is the message authority.** Prompt Studio always tries to fetch messages from the agent first and only falls back to cached content.
3. **Event stores are ephemeral.** They live in-memory for the duration of the API process and are not persisted.
4. **All session mutations emit to EventBus.** Clients receive real-time updates via SSE sync.
5. **Follow-ups can switch agents.** When the agent changes, the previous `agent_session_id` is cleared and a new session is started with the new agent.

## Current gaps

- Event stores are lost on API restart — no persistence layer. Stale `in_progress` sessions are reattached when the agent supports it (OpenCode) or transitioned to `disconnected` otherwise, via the startup sweep (`runStartupTasks` → `resolveOrphanedSessions`; see [Session Status Lifecycle](/architecture/session-status-lifecycle)).
- Queue routes exist as placeholders.
