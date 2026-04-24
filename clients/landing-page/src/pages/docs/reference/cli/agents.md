---
layout: ../../../../layouts/docs-layout.astro
title: pstdio agents
description: Reference for the pstdio agents command group.
htmlTitle: pstdio agents CLI
htmlDescription: Manage installed agents, install skills and plugins, and override binaries with the pstdio agents commands.
section: References
category: CLI
categoryOrder: 1
order: 6
---

## pstdio agents list

List available coding agents.

No options.

**SDK equivalent:** `client.agents.list()` → `GET /v1/agents`.

## pstdio agents setup &lt;agent-id&gt;

Configure an agent and install its skills and plugins.

**Positional args:**

- `agent-id` (required) — `claude-code`, `opencode`, …

**Options:**

- `--global-skills` — install skills into the agent's global config directory instead of the project.
- `--global-plugins` — install plugins globally instead of per-project.

**SDK equivalent:** `client.agents.setup(input)` → `POST /v1/agents`.

## pstdio agents update &lt;agent-id&gt;

Update an agent configuration.

**Positional args:**

- `agent-id` (required).

**Options:**

- `--default` — set as the default agent.
- `--binary <path>` — override the agent binary path.
- `--skills-dir <path>` — override the agent skills directory.

**SDK equivalent:** `client.agents.update(agentId, input)` → `PATCH /v1/agents/{agentId}`.

## pstdio agents remove &lt;agent-id&gt;

Remove a configured agent.

**Positional args:**

- `agent-id` (required).

**Options:**

- `--delete-skills` — also delete the skills installed for this agent.

**SDK equivalent:** `client.agents.delete(agentId)`.

## pstdio agents install-skills &lt;agent-id&gt;

Install skills for an agent without running the full setup.

**Positional args:**

- `agent-id` (required).

**Options:**

- `--global-skills` — install into the agent's global config directory.

## pstdio agents install-plugins &lt;agent-id&gt;

Install plugins for an agent without running the full setup.

**Positional args:**

- `agent-id` (required).

**Options:**

- `--global-plugins` — install into the agent's global config directory.

## Related pages

- [Configure agents](/docs/customization/configure-agents/).
- [`client.agents` reference](/docs/reference/sdk/client/#clientagents).
