---
status: draft
---

# Settings

View and manage global application settings. The settings page is accessible from the project list header and is not scoped to a specific project.

---

## Layout

```
+----------------------------------------------------------+
| Settings                                                  |
+----------------------------------------------------------+
|                                                           |
|  Agents                                                   |
|  +------------------------------------------------------+ |
|  | Claude Code  [INSTALLED]  [Default]         [===ON ] | |
|  |------------------------------------------------------| |
|  | OpenCode     [INSTALLED]                    [ OFF==] | |
|  |------------------------------------------------------| |
|  | Codex        [NOT FOUND]                    [ OFF==] | |
|  +------------------------------------------------------+ |
|                                                           |
+----------------------------------------------------------+
```

The page has a header with the title "Settings". Below, sections are stacked vertically. The first section is **Agents**.

---

## Routes

| Route       | View          |
| ----------- | ------------- |
| `/settings` | Settings page |

---

## Agents Section

Lists all known agents and their status. An agent is a coding assistant that can be launched from the dashboard (e.g. Claude Code, OpenCode, Codex).

### Agent Row

Each row displays:

| Element          | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| Name             | The agent's display name.                                                        |
| Installation     | Badge showing `INSTALLED` or `NOT FOUND`.                                        |
| Default indicator| The default agent shows a `Default` badge. Only visible on enabled agents.       |
| Toggle           | Switch to enable or disable the agent. Disabled (greyed out) when `NOT FOUND`.   |

### States

An agent row can be in one of three states:

| State                  | Toggle   | Default indicator         |
| ---------------------- | -------- | ------------------------- |
| Enabled (default)      | ON       | `Default` badge           |
| Enabled (not default)  | ON       | Hidden                    |
| Installed, not enabled | OFF      | Hidden                    |
| Not installed          | OFF, disabled | Hidden               |

### Behavior

- On load, fetch the list of known agents from the API.
- Show a loading skeleton while fetching.
- If no agents are returned, show an empty state.
- The toggle is disabled (greyed out) for agents with availability `NOT FOUND`. The user must install the agent binary before it can be enabled.

### Enabling an Agent

1. User toggles an installed agent ON.
2. A `POST /v1/agents` request is sent with `{ "agent_id": "<id>" }`.
3. On success, the agent list is refetched. If this is the first enabled agent, it becomes the default automatically.
4. On error, the toggle reverts and a toast shows the error message.

### Disabling an Agent

1. User toggles an enabled agent OFF.
2. A `DELETE /v1/agents/:agentId` request is sent.
3. On success, the agent list is refetched. If the disabled agent was the default, the API reassigns the default to another enabled agent.
4. On error, the toggle reverts and a toast shows the error message.

### Setting the Default Agent

The first enabled agent automatically becomes the default. When multiple agents are enabled, the user can change the default:

1. User clicks the `Default` badge area on a non-default enabled agent row (or via a context action).
2. A `PATCH /v1/agents/:agentId` request is sent with `{ "is_default": true }`.
3. On success, the agent list is refetched. The new default agent shows the `Default` badge.
4. On error, show a toast with the error message.

---

## Data Flow

### Fetching Agents

1. `GET /v1/agents/info` returns the list of known agents with their availability status.
2. `GET /v1/agents` returns configured agents with their `is_default` flag.
3. The UI merges both responses: each row shows the agent name and installation status from `/agents/info`, and the default status from `/agents`.

### Mutations

| Action      | Method   | Endpoint              | Body                     |
| ----------- | -------- | --------------------- | ------------------------ |
| Enable      | `POST`   | `/v1/agents`          | `{ "agent_id": "<id>" }` |
| Disable     | `DELETE` | `/v1/agents/:agentId` | —                        |
| Set default | `PATCH`  | `/v1/agents/:agentId` | `{ "is_default": true }` |

On mutation success, invalidate the agents query to refetch the list.

---

## Error Handling

| Scenario               | Behavior                                              |
| ---------------------- | ----------------------------------------------------- |
| Agents fail to load    | Show error state with a retry button.                 |
| Enable fails           | Revert toggle to OFF. Show toast with error message.  |
| Disable fails          | Revert toggle to ON. Show toast with error message.   |
| Set default fails      | Show toast with error message. No state change.       |
