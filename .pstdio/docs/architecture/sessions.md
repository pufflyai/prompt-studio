# Sessions

pstdio tracks conversations between users and coding agents as sessions. A session captures the full lifecycle — from prompt submission through agent execution to completion or failure — and bridges the database, agent layer, API, and dashboard.

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

- `session.id` — pstdio's database record for lifecycle, metadata, and cached content.
- `session.agent_session_id` — the external agent's own session/thread ID (for `opencode` or `claude-code`).

A session is optionally associated with a workspace (`workspace.session_id`). When linked, the workspace anchors repo/worktree context. When no workspace is linked, the session runs at the project root.

### Session ↔ workspace ↔ ticket relationship

```
ticket ──┐
         │ ticket_workspaces (join)
         ▼
     workspace ──── session
       │
       ├── branch
       ├── worktree_path
       └── workspace_shorthand (e.g. A0001)
```

- A workspace belongs to at most one ticket (unique constraint on `workspace_id` in `ticket_workspaces`).
- A workspace has at most one session (`workspace.session_id`).
- Ticket attempts are workspaces with attempt naming (`Attempt N`) and linked sessions.

## Data model

### `sessions` table

| Column               | Type          | Notes                                                  |
| -------------------- | ------------- | ------------------------------------------------------ |
| id                   | text PK       | Unique session identifier                              |
| title                | text NOT NULL | Human-readable title                                   |
| status               | enum          | `in_progress`, `awaiting_input`, `completed`, `failed`, `cancelled` |
| archived             | boolean       | Soft-delete flag, default `false`                      |
| created              | text          | Initial creation timestamp                             |
| last_request_started | text          | When last agent request began                          |
| last_request_ended   | text          | When last agent request finished                       |
| agent                | text          | `"claude-code"` or `"opencode"`                        |
| agent_session_id     | text          | External agent session ID (nullable)                   |
| session_file_id      | text FK       | Reference to `files` table for cached content          |
| created_at           | text          | Row creation timestamp                                 |
| updated_at           | text          | Row update timestamp                                   |

### `workspaces` table (session-relevant columns)

| Column              | Type          | Notes                                        |
| ------------------- | ------------- | -------------------------------------------- |
| id                  | text PK       | Unique workspace identifier                  |
| project_id          | text FK       | References `projects.id`                     |
| name                | text NOT NULL | Display name (e.g. `Session 1`, `Attempt 2`) |
| session_id          | text FK       | References `sessions.id`, SET NULL on delete |
| branch              | text          | Git branch name                              |
| worktree_path       | text          | Absolute path to git worktree                |
| status              | enum          | `active`, `merged`, `rejected`               |
| workspace_shorthand | text NOT NULL | Unique within project (e.g. `A0001`)         |

### Session response enrichment

Session API responses are enriched from workspace context:

- `workspace_id`, `branch`, `worktree_path`
- Derived ticket metadata: `ticket_shorthand`, `attempt_number` (parsed from `Attempt N` workspace name)

## Session lifecycle

### Status semantics

| Status           | Meaning                                     |
| ---------------- | ------------------------------------------- |
| `in_progress`    | Agent is actively executing                 |
| `awaiting_input` | Agent is waiting for user approval or input |
| `completed`      | Agent finished successfully                 |
| `failed`         | Agent crashed or returned non-zero exit     |
| `cancelled`      | Session was stopped by user                 |

### Status transitions

```
create / follow-up ──► in_progress
                           │
              ┌────────────┼────────────┬────────────┐
              ▼            ▼            ▼            ▼
       awaiting_input  completed     failed      cancelled
              │                                  (via stop)
              ▼
        in_progress (on approval response)
```

- Create session → `in_progress`
- Follow-up → forces `in_progress`
- Process exit `0` → `completed`
- Process exit non-zero → `failed`
- Approval request → `awaiting_input`
- User stop → `cancelled` (graceful signal, force-kill after 30s timeout)
- Transport/fetch error during follow-up → `failed` + error in cached messages

### Completion heuristic

When a session is `in_progress`, no active event store exists, and the last message has a `step-finish` part with reason `stop`, pstdio marks the session `completed`.

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

1. Validate repository (if `repo_id` provided).
2. If `workspace_id` is provided, link session to existing workspace. Otherwise, the session has no workspace and runs at project root.
3. Create session with status `in_progress`.
4. Resolve agent from request or global default (`agent_configs.is_default`).
5. Create in-memory event store for streaming.
6. Call `agent.startSession(...)` with prompt/title/model and cwd.
7. Persist `agent_session_id` when agent session starts.
8. Track process exit to set status `completed`/`failed`/`cancelled`, push status patch, clean up stream state.

### 2) Ticket + session — `POST /v1/tickets/create-and-start`

Creates ticket, workspace (`Attempt N`), and session in one operation, then starts the agent.

- `session.title` is derived from ticket content title.
- `cwd` is repository root if `repo_id` is provided.
- Non-zero agent process exit marks session `failed`.

### 3) Ticket attempt — `POST /v1/tickets/:ticket_id/attempts`

Creates a ticket attempt workspace + session and starts the agent.

Modes:

- `worktree` (default): creates branch `workspace/<workspace_shorthand>` and a git worktree at `<workspaces_root>/<workspace_shorthand>`
- `current_branch`: reuses current repo branch/root

`workspaces_root` resolution order:

1. `PSTDIO_WORKSPACES_DIR`
2. `$HOME/.pstdio/workspaces`
3. `os.homedir()/.pstdio/workspaces`

Prompt resolution order:

1. explicit request `prompt`
2. ticket content file body
3. ticket title fallback (`display_title` then `shorthand`)

The route always creates a ticket-linked workspace row, emits sync updates for `workspaces` + `ticket_workspaces`, and defaults `start_session` to `true`. When a session is started, it links `workspaces.session_id`, emits `sessions` + `workspaces` updates, and starts the agent in the resolved cwd.

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
2. Set status back to `in_progress`.
3. Resolve cwd: workspace root if linked (`worktree_path` first, repo path fallback), otherwise project root.
4. **Same agent:** require `agent_session_id`, call `agent.resumeSession(...)` with `messageOffset` from cached message count.
5. **Different agent:** update `session.agent`, clear previous `agent_session_id`, call `agent.startSession(...)`.
6. On errors: append assistant error text to cached messages and set status `failed`.

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

1. **Sessions optionally link to a workspace.** When linked, the workspace provides cwd and diff context. Without a workspace, the session runs at the project root and has no diff tracking.
2. **Agent is the message authority.** pstdio always tries to fetch messages from the agent first and only falls back to cached content.
3. **Event stores are ephemeral.** They live in-memory for the duration of the API process and are not persisted.
4. **All session mutations emit to EventBus.** Clients receive real-time updates via SSE sync.
5. **Follow-ups can switch agents.** When the agent changes, the previous `agent_session_id` is cleared and a new session is started with the new agent.

## Current gaps

- Session DB service layer (`createSessionsService`) is not yet implemented.
- Dedicated session API endpoints (create, get, follow-up, stream, stop, approve) are not yet wired up.
- Session SSE streaming endpoint is not yet implemented.
- Approval flow end-to-end (SSE push + POST response) is not yet connected.
- Event stores are lost on API restart — no persistence layer.
- `ticket_attempts` Zod schema exists but has no DB table (virtual/API-only).
- Queue routes exist as placeholders.
