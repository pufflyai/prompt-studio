# Agents

pstdio delegates coding work to external agent processes (Claude Code, OpenCode). The API manages agent configuration and lifecycle; each agent implements a common interface but communicates over its own protocol.

## Architecture

```
┌───────────┐   ┌───────────────┐
│    CLI    │   │   Dashboard   │
└─────┬─────┘   └───────┬───────┘
      │                 │
      └─────────────────┘
              │  HTTP
                      ▼
              ┌───────────────┐
              │   pstdio-api  │
              │  /v1/agents/* │
              └───────┬───────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   ┌──────────────┐      ┌──────────────┐
   │ AgentRegistry│      │  pstdio-db   │
   │  (in-memory) │      │ agent_configs│
   └──────┬───────┘      └──────────────┘
          │
     ┌────┴────┐
     ▼         ▼
┌─────────┐ ┌──────────┐
│ Claude  │ │ OpenCode │
│  Code   │ │          │
│ (stdio) │ │ (HTTP)   │
└─────────┘ └──────────┘
```

## Core concepts

### AgentService interface

Every agent implements `AgentService` from `pstdio-agents`. The interface normalizes session management across different agent binaries:

- **checkAvailability** — detects whether the agent binary is installed (`spawnSync("<binary>", ["--version"])`)
- **capabilities** — declares supported features (`SessionFork`, `ContextUsage`, `Approvals`)
- **listModels** — returns available models for the agent
- **startSession / resumeSession** — creates or continues a coding session
- **getMessages** — retrieves normalized session messages
- **listSessions / exportSession** — session management

### AgentRegistry

An in-memory lookup that holds instantiated `AgentService` objects. Created once at startup:

```
createAgentRegistry([createClaudeCodeAgent(), createOpencodeAgent()])
```

- `get(agentId)` — returns the service or `null`
- `list()` — returns all registered services

### Agent configuration (database)

The `agent_configs` table in `pstdio-db` stores per-agent settings:

| Column     | Type    | Purpose                                    |
| ---------- | ------- | ------------------------------------------ |
| agent_id   | string  | `"claude-code"` or `"opencode"`            |
| is_default | boolean | Only one agent can be the default          |
| config     | JSON    | Binary path and skills directory overrides |

Managed through `createAgentConfigsService(db)` which handles upsert, update, list, get, and remove. Removing the current default automatically reassigns the default.

## API endpoints

| Method | Path                    | Description                        |
| ------ | ----------------------- | ---------------------------------- |
| GET    | /v1/agents              | List configured agents             |
| GET    | /v1/agents/availability | Check if an agent binary is found  |
| POST   | /v1/agents              | Register / setup a new agent       |
| PATCH  | /v1/agents/:agentId     | Update config (default, binary)    |
| DELETE | /v1/agents/:agentId     | Remove agent, optionally rm skills |

All mutation endpoints emit events to the EventBus so clients receive real-time updates via SSE.

## Communication protocols

### Claude Code — stdio streams

Claude Code runs as a child process. pstdio spawns it and communicates over stdin/stdout using newline-delimited JSON.

```
pstdio                            claude (child process)
  │                                       │
  │── spawn("claude", [flags]) ──────────►│
  │                                       │
  │── stdin: {"type":"user", ...} ───────►│
  │                                       │
  │◄── stdout: {"type":"system", ...} ────│  (session_id)
  │◄── stdout: {"type":"assistant", ...} ─│  (streaming response)
  │◄── stdout: {"type":"control_request"} │  (permission request)
  │── stdin: {"type":"control_response"} ►│  (approve / deny)
  │                                       │
```

Key spawn flags: `--output-format stream-json`, `--input-format stream-json`, `--permission-prompt-tool stdio`. Resuming a session uses `--resume <sessionId>`.

Session transcripts are stored at `~/.claude/projects/{project-hash}/{sessionId}.jsonl`.

### OpenCode — HTTP server

OpenCode runs a persistent HTTP server on `127.0.0.1:4096`. pstdio starts the server if it isn't already running and stores the URL in `~/.pstdio/opencode-server.txt`.

```
pstdio                            opencode (HTTP server :4096)
  │                                       │
  │── POST /session ─────────────────────►│
  │◄── { id } ────────────────────────────│
  │                                       │
  │── POST /session/:id/message ─────────►│
  │◄── { parts, messages } ──────────────│
  │                                       │
  │── polling (1s) for new messages ─────►│
  │◄── delta updates ────────────────────│
```

All requests include the header `x-opencode-directory` pointing to the working directory.

OpenCode model payloads are provider-specific and are built only inside the OpenCode adapter:

- Session create receives pstdio's model string (`openai/gpt-5.5`) and sends `{ "model": { "providerID": "openai", "id": "gpt-5.5" } }`.
- Session message/follow-up sends `{ "model": { "providerID": "openai", "modelID": "gpt-5.5" } }`.

Callers outside the OpenCode adapter pass only pstdio's model string. They must not construct OpenCode payload objects.

### Message patching strategies

The two providers use fundamentally different strategies for pushing messages to the EventStore, which affects how follow-up (resume) messages are rendered on the frontend.

**Claude Code — offset-based incremental patches**

Claude Code streams events incrementally as they happen. The `createMessageAccumulator` tracks an `indexOffset` so that follow-up patches start after the existing messages:

```
Initial session:   /messages/0 (user), /messages/1 (assistant)
Follow-up patches: /messages/2 (user), /messages/3 (assistant)
```

The EventStore only contains the delta (follow-up patches). The frontend must already have the original messages loaded — either from the stream's persisted-message replay or from the session cache — for the offset indices to land correctly.

**OpenCode — full-array replacement**

OpenCode polls its HTTP server every second and always pushes the complete message array:

```
{ op: "replace", path: "/messages", value: [all messages] }
```

The server owns the canonical message list. Each poll cycle replaces the entire array atomically, so message ordering is always correct regardless of frontend state.

**Why this matters for resume**

When a session is resumed, the stream endpoint creates a fresh EventStore. Claude Code's EventStore only contains the new follow-up patches (starting at a non-zero offset). If the frontend applies these to an empty array, the original messages are missing and the follow-up appears alone or out of order.

OpenCode is unaffected because every poll cycle replaces the full array — the frontend never needs prior state.

The stream endpoint addresses this by replaying persisted messages before live patches for resumed sessions. The frontend also seeds its message state from cache on reconnect.

## Session identity for attempt-status hooks

Attempt status is workspace-scoped.

`session_id` is used to point back to the agent session that performed a status change when `post-attempt-status-*` delivery should be deferred until that session terminates.

This is why session identity must be propagated when agent flows call:

```sh
pstdio workspaces set-status --status <status>
```

If a user runs `pstdio workspaces set-status` directly, `--session-id` can be omitted. The workspace status still updates, and post-hook delivery falls back to immediate execution after commit.

### Why provider behavior differs

Provider runtime model determines whether per-session env is reliable:

- **Claude Code (stdio child process):** pstdio can inject `PSTDIO_SESSION_ID` per spawn/resume call.
- **OpenCode (shared HTTP server):** process env passed at session start is shared at server level, so it is not a reliable per-session channel under concurrency.

OpenCode's `shell.env` plugin hook is the correct bridge point for shell execution. The plugin can inject env vars per shell run, and newer OpenCode builds can pass optional `sessionID` and `callID` into that hook for bash/prompt execution paths.

### Contract

1. The canonical correlation key is `session_id` on `PATCH /v1/workspaces/{id}/attempt-status`.
2. `pstdio workspaces set-status` supports `--session-id` and should pass it in agent-driven flows. User-driven calls can omit it.
3. Queue behavior stays **last status wins per session** (single queued post-hook entry keyed by session id).
4. When `session_id` is absent, post-hook delivery is immediate (not queued/deferred).

### Provider-specific strategy

- **Claude Code path:** use env propagation (`PSTDIO_SESSION_ID`) and pass it through in hook scripts.
- **OpenCode path:** use a pstdio-managed `shell.env` plugin. The plugin reads OpenCode's optional `sessionID`, resolves it to the matching pstdio session, and exports `PSTDIO_SESSION_ID` into shell execution so the existing CLI fallback continues to work.

This keeps session correlation explicit without relying on prompt compliance, and avoids ambiguous workspace-only inference when multiple sessions run in parallel.

Longer term, once OpenCode exposes session env directly to child processes without a custom plugin, pstdio should consume that native env and remove the separate OpenCode plugin-install step.

## Permissions and approvals

Claude Code supports interactive tool approvals. When the agent needs permission to run a tool, it sends a `control_request` over stdout. pstdio routes this through an `ApprovalService` and writes back a `control_response` (approve / deny / timeout) over stdin.

## Skills

When an agent is set up, pstdio installs default skills into the agent's skill directory:

- Claude Code: `.claude/skills/`
- OpenCode: `.opencode/skills/`

Skills can also be installed globally (`~/.claude/skills/`) via the `--global-skills` flag.

## Rules

1. **Agents are external processes.** pstdio never embeds LLM logic — it delegates to agent binaries and normalizes their output.
2. **All agent config goes through the API.** Clients never write to `agent_configs` directly.
3. **One default agent at a time.** The `is_default` flag is mutually exclusive.
4. **Availability is checked at runtime.** The registry holds all known agents; the database tracks which ones are configured. A configured agent whose binary is missing reports `NOT_FOUND`.
