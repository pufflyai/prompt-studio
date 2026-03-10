---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Sessions

## Summary

This PRD documents session lifecycle commands, including create, list, view, follow-up, stream, approval flow, and stop/archive behavior.

## Detailed Behavior


## Purpose

Manage agent sessions from the terminal. Sessions track the lifecycle of a conversation between a user prompt and a coding agent, optionally anchored to a workspace.

---

## Terminology

- **Session**: a DB record tracking a single agent conversation — prompt, status, agent type, and cached messages.
- **Session ID**: pstdio's internal identifier for the session (`session.id`).
- **Agent Session ID**: the external agent's own session/thread ID (e.g. Claude Code session, OpenCode thread).
- **Workspace**: the execution environment where the agent operates. An instantiation of the project's repo configuration. A session optionally belongs to a workspace.

---

## Command Summary

| Command                      | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `pstdio sessions view`      | Show session summary.                            |
| `pstdio sessions list`      | List sessions for the current project.           |
| `pstdio sessions create`    | Start a new project session and launch an agent. |
| `pstdio sessions follow-up` | Send a follow-up prompt to an existing session.  |
| `pstdio sessions stream`    | Tail live session output in the terminal.        |
| `pstdio sessions approve`   | Approve a pending agent tool permission request. |
| `pstdio sessions deny`      | Deny a pending agent tool permission request.    |
| `pstdio sessions stop`      | Gracefully stop a running session.               |
| `pstdio sessions archive`   | Soft-delete a session.                           |

---

## ID Resolution

All commands that accept `--id` resolve the value as either a session ID or a session shorthand. Both are unique identifiers.

---

## `pstdio sessions view`

### Usage

```sh
pstdio sessions view --id <session-id>
```

### Flags

| Flag   | Type     | Required | Description                |
| ------ | -------- | -------- | -------------------------- |
| `--id` | `string` | yes      | The session ID to look up. |

### Behavior

1. Fetch the session from the database by ID.
2. If the session has a linked workspace, resolve the workspace shorthand.
3. If the workspace is linked to a ticket (via `ticket_workspaces`), resolve the ticket shorthand.
4. Display a summary of the session.

### Output

```text
Session:     s_abc123
Status:      completed
Agent:       claude-code
Workspace:   PS-12_A1
Ticket:      PS-12
Branch:      workspace/PS-12_A1
Started:     2026-03-05T10:00:00Z
Finished:    2026-03-05T10:05:32Z
```

When no workspace is linked, the `Workspace`, `Ticket`, and `Branch` lines are omitted.

When no ticket is linked, the `Ticket` line is omitted.

When the session is `in_progress`, the `Finished` line is omitted.

### Errors

- `"Session not found: <id>"`: the session does not exist.

---

## `pstdio sessions list`

### Usage

```sh
pstdio sessions list [--project-id <project-id>] [--status <status>] [--agent <agent>] [--workspace-id <workspace-id>] [--archived]
```

### Flags

| Flag             | Type      | Required | Description                                                                                     |
| ---------------- | --------- | -------- | ----------------------------------------------------------------------------------------------- |
| `--project-id`   | `string`  | no       | Target project. Defaults to the current project from `.pstdio/config.json`.                     |
| `--status`       | `string`  | no       | Filter by session status (`in_progress`, `awaiting_input`, `completed`, `failed`, `cancelled`). |
| `--agent`        | `string`  | no       | Filter by agent type (`claude-code`, `opencode`).                                               |
| `--workspace-id` | `string`  | no       | Filter by workspace ID or shorthand.                                                            |
| `--archived`     | `boolean` | no       | Include archived sessions. Excluded by default.                                                 |

### Behavior

1. Resolve the project from `--project-id` or `.pstdio/config.json`.
2. Fetch all non-archived sessions for the project from the database.
3. Apply any provided filters. Multiple filters are combined with AND.
4. Resolve workspace shorthand and ticket shorthand for each session that has a linked workspace.

### Output

```text
ID           Status        Agent         Workspace   Ticket   Started
s_abc123     completed     claude-code   PS-12_A1    PS-12    2026-03-05T10:00:00Z
s_def456     in_progress   opencode      PS-13_A1    PS-13    2026-03-05T11:30:00Z
s_ghi789     failed        claude-code   -           -        2026-03-05T12:00:00Z
```

If no sessions exist:

```text
No sessions found.
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.

---

## `pstdio sessions create`

### Usage

```sh
pstdio sessions create --prompt <prompt> [--title <title>] [--workspace-id <workspace-id>] [--project-id <project-id>] [--agent <agent>] [--model <model>]
```

### Flags

| Flag             | Type     | Required | Description                                                                                                     |
| ---------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `--prompt`       | `string` | yes      | The initial prompt to send to the agent.                                                                        |
| `--title`        | `string` | no       | Session title. When omitted, derived from the first ~50 characters of `--prompt`.                               |
| `--workspace-id` | `string` | no       | Workspace ID or shorthand to attach the session to (e.g. `PS-12_A1`).                                          |
| `--project-id`   | `string` | no       | Target project. Defaults to the current project from `.pstdio/config.json`.                                     |
| `--agent`        | `string` | no       | Agent to use (`claude-code`, `opencode`). Defaults to the global default agent from `agent_configs.is_default`. |
| `--model`        | `string` | no       | Model override for the agent (e.g. `claude-haiku-4-5-20251001`).                                                |

### Behavior

**With `--workspace-id`:**

1. Resolve the workspace from `--workspace-id`.
2. Verify the workspace has no active session (i.e. `session_id` is null or the linked session is not `in_progress`).
3. Call `POST /api/sessions` with the workspace ID and provided parameters.
4. The API creates the session with status `in_progress`, links it to the workspace (`workspaces.session_id`), and starts the agent in the workspace root directory (`~/.pstdio/workspaces/<shorthand>/`).
5. Print the session ID and workspace info.

**Without `--workspace-id`:**

1. Resolve the project from `--project-id` or `.pstdio/config.json`.
2. Call `POST /api/sessions` with the provided parameters.
3. The API creates the session with status `in_progress` and starts the agent at the project root.
4. Print the session ID.

### Output

With a workspace:

```text
Created session s_abc123
Workspace: PS-12_A1
Agent:     claude-code
Status:    in_progress
```

Without a workspace:

```text
Created session s_abc123
Agent:     claude-code
Status:    in_progress
```

### Errors

- `"Not inside a pstdio project. Run 'pstdio projects create' first."`: no `--project-id` flag and no `.pstdio/config.json` found.
- `"Project not found: <project-id>"`: the given project ID does not exist.
- `"Workspace not found: <workspace-id>"`: the given workspace does not exist.
- `"Workspace already has an active session: <session-id>"`: the workspace is already running a session.
- `"No agent configured. Set a default agent with 'pstdio agents setup' first."`: no default agent in `agent_configs` and none specified via `--agent`.

---

## `pstdio sessions follow-up`

### Usage

```sh
pstdio sessions follow-up --id <session-id> --prompt <prompt> [--agent <agent>] [--model <model>]
```

### Flags

| Flag       | Type     | Required | Description                                                          |
| ---------- | -------- | -------- | -------------------------------------------------------------------- |
| `--id`     | `string` | yes      | The session ID to continue.                                          |
| `--prompt` | `string` | yes      | The follow-up prompt.                                                |
| `--agent`  | `string` | no       | Switch agent for this follow-up. Clears previous `agent_session_id`. |
| `--model`  | `string` | no       | Model override for the agent.                                        |

### Behavior

1. Call `POST /api/sessions/:session_id/follow-up` with the provided parameters.
2. The API sets the session back to `in_progress` and sends the prompt to the agent.
3. The agent runs in the session's workspace root directory if a workspace is linked, otherwise at the project root.
4. If `--agent` differs from the current session agent, the API clears the previous `agent_session_id` and starts a new agent session.
5. Print confirmation.

### Output

```text
Follow-up sent to session s_abc123
Agent:  claude-code
Status: in_progress
```

### Errors

- `"Session not found: <id>"`: the session does not exist.
- `"Session is in_progress — wait for it to finish or fail before sending a follow-up."`: cannot follow up on an active session.

---

## `pstdio sessions stream`

### Usage

```sh
pstdio sessions stream --id <session-id>
```

### Flags

| Flag   | Type     | Required | Description               |
| ------ | -------- | -------- | ------------------------- |
| `--id` | `string` | yes      | The session ID to stream. |

### Behavior

1. Connect to `GET /api/sessions/:session_id/stream` via SSE.
2. Wait for the `ready` event (`{ sessionId }`).
3. Stream incoming `patch` events to the terminal, rendering agent output as it arrives.
4. If an `approval_request` event arrives, print the request details and note that approval must be handled via `pstdio sessions approve --id <session-id>`.
5. When the server sends an `end` event, print the session's final status and exit.
6. On connection error, print the error and exit with code `1`.

### SSE Events

| Event              | Payload                                           | Description                       |
| ------------------ | ------------------------------------------------- | --------------------------------- |
| `ready`            | `{ sessionId }`                                   | Connection established.           |
| `patch`            | `{ op, path, value }`                             | JSON patch for message updates.   |
| `approval_request` | `{ id, toolName, toolInput, toolUseId }`          | Agent requests tool permission.   |
| `heartbeat`        | `{}`                                              | Keep-alive.                       |
| `end`              | `{ status }`                                      | Session finished, stream closing. |

### Output

```text
Streaming session s_abc123...

[agent output streamed in real-time]

Session s_abc123 completed.
```

When the session requires approval:

```text
Streaming session s_abc123...

[agent output]

⏸ Awaiting approval — use 'pstdio sessions approve --id s_abc123' to continue.
```

When no active stream exists:

```text
No active stream for session s_abc123. Session status: completed.
```

### Errors

- `"Session not found: <id>"`: the session does not exist.
- `"Connection failed: <reason>"`: SSE connection error.

---

## `pstdio sessions approve`

### Usage

```sh
pstdio sessions approve --id <session-id>
```

### Flags

| Flag   | Type     | Required | Description                 |
| ------ | -------- | -------- | --------------------------- |
| `--id` | `string` | yes      | The session ID to approve.  |

### Behavior

1. Fetch the session from the database.
2. Verify the session status is `awaiting_input`.
3. Send `POST /api/sessions/:session_id/approve` with `{ decision: "approve" }`.
4. The API forwards the approval to the agent and sets the session back to `in_progress`.

### Output

```text
Approved tool request for session s_abc123.
Session s_abc123 resumed.
```

### Errors

- `"Session not found: <id>"`: the session does not exist.
- `"Session is not awaiting input"`: the session is not in `awaiting_input` status.

---

## `pstdio sessions deny`

### Usage

```sh
pstdio sessions deny --id <session-id>
```

### Flags

| Flag   | Type     | Required | Description              |
| ------ | -------- | -------- | ------------------------ |
| `--id` | `string` | yes      | The session ID to deny.  |

### Behavior

1. Fetch the session from the database.
2. Verify the session status is `awaiting_input`.
3. Send `POST /api/sessions/:session_id/approve` with `{ decision: "deny" }`.
4. The API forwards the denial to the agent and sets the session back to `in_progress`.

### Output

```text
Denied tool request for session s_abc123.
Session s_abc123 resumed.
```

### Errors

- `"Session not found: <id>"`: the session does not exist.
- `"Session is not awaiting input"`: the session is not in `awaiting_input` status.

---

## `pstdio sessions stop`

### Usage

```sh
pstdio sessions stop --id <session-id>
```

### Flags

| Flag   | Type     | Required | Description              |
| ------ | -------- | -------- | ------------------------ |
| `--id` | `string` | yes      | The session ID to stop.  |

### Behavior

1. Fetch the session from the database.
2. Verify the session status is `in_progress` or `awaiting_input`.
3. Send `POST /api/sessions/:session_id/stop`.
4. The API sends a graceful shutdown signal to the agent process.
5. If the agent does not exit within 30 seconds, the API force-kills the process.
6. The session status is set to `cancelled`.

### Output

```text
Stopped session s_abc123.
```

### Errors

- `"Session not found: <id>"`: the session does not exist.
- `"Session is not running"`: the session is not `in_progress` or `awaiting_input`.

---

## `pstdio sessions archive`

### Usage

```sh
pstdio sessions archive --id <session-id>
```

### Flags

| Flag   | Type     | Required | Description                |
| ------ | -------- | -------- | -------------------------- |
| `--id` | `string` | yes      | The session ID to archive. |

### Behavior

1. Resolve the session from the database.
2. Set `archived=true` on the session.
3. Archived sessions are excluded from `sessions list` by default (use `--archived` to include them).

### Output

```text
Archived session s_abc123
```

### Errors

- `"Session not found: <id>"`: the session does not exist.
- `"Session already archived: <id>"`: the session is already archived.

---

## Database Side Effects

| Table        | Description                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `sessions`   | Session lifecycle metadata (`status`, `agent`, `agent_session_id`, `archived`).                              |
| `workspaces` | Workspace links to session via `session_id`. Updated by `sessions create` when `--workspace-id` is provided. |

---

## Exit Codes

- `0`: Command completed successfully.
- `1`: Command failed (validation error, connection error, or session not found).
