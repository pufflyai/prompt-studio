# Agents

Prompt Studio delegates coding work to external agent processes (Claude Code, OpenCode). The API manages agent configuration and lifecycle; each agent implements a common interface but communicates over its own protocol.

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

### Harness run parameters

Harness extensions may declare discrete run parameters in addition to the shared
model selector. The host accepts only enum-like `select` descriptors and
booleans, so every declared value can be rendered by clients, validated at the
API boundary, and serialized as `Record<string, string | boolean>`.

```
extension harness schema
        │
        ▼
runtime normalization ── rejects unsupported descriptor types
        │
        ▼
/v1/agents/info ─────── dashboard renders controls from schema
        │
        ▼
project defaults ⊕ run overrides
        │
        ▼
HarnessStartInput.params / HarnessResumeInput.params
```

Project-scoped defaults are stored in the existing extension settings value
store under a host-owned owner key for `(project, harness)`. Run overrides are
kept transient in the dashboard and submitted with the start or follow-up
request. Queued requests persist the effective params with their queue entry so
dispatch receives the same values the user submitted.

Validation happens twice:

1. Extension normalization refuses harness schemas that contain anything other
   than `select` or `boolean` descriptors.
2. The runtime harness handle validates submitted params before invoking
   `start()` or `resume()`, so malformed API requests cannot reach provider
   code.

Thinking controls are model-specific. `AgentModel` metadata may replace a base
harness descriptor or remove it with `null`; the dashboard and runtime resolve
that metadata for the selected model before rendering, defaulting, or
validating params. When no stored model applies, the catalog entry marked
`isDefault` is selected, falling back to the first available model.

The shipped harnesses discover and cache their catalogs instead of maintaining
model allowlists:

- Codex queries the app-server `model/list` method and maps each model's
  `supportedReasoningEfforts` and `defaultReasoningEffort`.
- Claude Code uses its streaming control initialization response, which
  includes `supportsEffort` and `supportedEffortLevels` per model.
- OpenCode parses `opencode models --verbose` and maps each model's `variants`.

Catalog entries also carry display labels and descriptions for generic clients.
Discovery failures leave the provider default and base harness schema usable;
successful catalogs are cached for five minutes per harness instance.

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

Claude Code runs as a child process. Prompt Studio spawns it and communicates over stdin/stdout using newline-delimited JSON.

```
pst                               claude (child process)
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

OpenCode runs a persistent HTTP server on `127.0.0.1:4096`. Prompt Studio starts the server if it isn't already running and stores its extension-owned state in `~/.pstdio/state/pstdio.opencode.json`.

```
pst                               opencode (HTTP server :4096)
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

- Session create receives Prompt Studio's model string (`openai/gpt-5.5`) and sends `{ "model": { "providerID": "openai", "id": "gpt-5.5" } }`.
- Session message/follow-up sends `{ "model": { "providerID": "openai", "modelID": "gpt-5.5" } }`.

Callers outside the OpenCode adapter pass only Prompt Studio's model string. They must not construct OpenCode payload objects.

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

## Planner workspace status automation

Attempt/workspace review status is planner extension state, not a core
workspace column or core API endpoint.

Planner records the status for a host workspace and keeps enough metadata to
correlate review sessions with the original implementation session:

1. `review-ready` creates a review session in the same workspace with
   `original_session_id` pointing to the implementation session.
2. `changes-requested` follows up the original implementation session with the
   review result.
3. `reviewed` participates in the aggregate planner rule that moves the ticket
   to `In Review` when all linked active workspaces are reviewed.

Agents should call planner commands or planner-provided helpers when marking
workspace review status. The removed core path
`PATCH /v1/workspaces/{id}/attempt-status` must not be reintroduced.

## Permissions and approvals

Claude Code supports interactive tool approvals. When the agent needs permission to run a tool, it sends a `control_request` over stdout. Prompt Studio routes this through an `ApprovalService` and writes back a `control_response` (approve / deny / timeout) over stdin.

## Skills

When an agent is set up, Prompt Studio installs default skills into the agent's skill directory:

- Claude Code: `.claude/skills/`
- OpenCode: `.agents/skills/`

Skills can also be installed globally (for example, `~/.claude/skills/` or `~/.agents/skills/`) via the
`--global-skills` flag.

## Rules

1. **Agents are external processes.** Prompt Studio never embeds LLM logic — it delegates to agent binaries and normalizes their output.
2. **All agent config goes through the API.** Clients never write to `agent_configs` directly.
3. **One default agent at a time.** The `is_default` flag is mutually exclusive.
4. **Availability is checked at runtime.** The registry holds all known agents; the database tracks which ones are configured. A configured agent whose binary is missing reports `NOT_FOUND`.
