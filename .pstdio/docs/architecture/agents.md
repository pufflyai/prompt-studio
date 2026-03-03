# Agents

pstdio delegates coding work to external agent processes (Claude Code, OpenCode). The API manages agent configuration and lifecycle; each agent implements a common interface but communicates over its own protocol.

## Architecture

```
┌───────────┐   ┌───────────┐   ┌───────────────┐
│    CLI    │   │    TUI    │   │   Dashboard   │
└─────┬─────┘   └─────┬─────┘   └───────┬───────┘
      │               │                 │
      └───────────────┼─────────────────┘
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
| is_default | boolean | Only one agent can be the default           |
| config     | JSON    | Binary path and skills directory overrides  |

Managed through `createAgentConfigsService(db)` which handles upsert, update, list, get, and remove. Removing the current default automatically reassigns the default.

## API endpoints

| Method | Path                          | Description                        |
| ------ | ----------------------------- | ---------------------------------- |
| GET    | /v1/agents                    | List configured agents             |
| GET    | /v1/agents/availability       | Check if an agent binary is found  |
| POST   | /v1/agents                    | Register / setup a new agent       |
| PATCH  | /v1/agents/:agentId           | Update config (default, binary)    |
| DELETE | /v1/agents/:agentId           | Remove agent, optionally rm skills |

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
  │── POST /v1/session/start ────────────►│
  │◄── { sessionId, messages } ───────────│
  │                                       │
  │── POST /v1/session/prompt ───────────►│
  │◄── { parts, messages } ──────────────│
  │                                       │
  │── polling (1s) for new messages ─────►│
  │◄── delta updates ────────────────────│
```

All requests include the header `x-opencode-directory` pointing to the working directory.

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
