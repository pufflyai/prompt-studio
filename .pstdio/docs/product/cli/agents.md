---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Agents

## Summary

The `pstdio agents` command group configures agent integrations and installs bundled skills for those agents.

## Command Summary

| Command | Purpose |
| ------- | ------- |
| `pstdio agents list` | List available agents and whether they are configured, installed, and default. |
| `pstdio agents setup <agent-id>` | Configure one agent and install skills for it. |
| `pstdio agents update <agent-id>` | Update agent config fields (`--default`, `--binary`, `--skills-dir`). |
| `pstdio agents remove <agent-id>` | Remove a configured agent. |
| `pstdio agents install-skills <agent-id>` | Install bundled skills for an agent without reconfiguring it. |

## `pstdio agents list`

```sh
pstdio agents list
```

Prints a table with columns:

- `Agent`
- `Configured` (`yes`/`no`)
- `Installed` (`yes`/`no`, detected via `which <binary>`)
- `Default` (`yes` for the default agent)

## `pstdio agents setup <agent-id>`

```sh
pstdio agents setup <agent-id> [--global-skills]
```

| Flag | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `--global-skills` | `boolean` | `false` | Install skills to the agent's global config directory instead of the current project. |

Behavior:

1. Validate `agent-id` against known agents.
2. Configure the agent via API.
3. Install bundled skills for that agent.
4. If run outside git and `--global-skills` is unset, print a skip message and stop installation.
5. If run without a linked project and `--global-skills` is unset, print a skills skip message.

## `pstdio agents update <agent-id>`

```sh
pstdio agents update <agent-id> [--default] [--binary <path>] [--skills-dir <path>]
```

| Flag | Type | Description |
| ---- | ---- | ----------- |
| `--default` | `boolean` | Set as default agent. |
| `--binary` | `string` | Override agent binary path. |
| `--skills-dir` | `string` | Override agent skills directory. |

## `pstdio agents remove <agent-id>`

```sh
pstdio agents remove <agent-id> [--delete-skills]
```

| Flag | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `--delete-skills` | `boolean` | `false` | Also remove bundled skills for this agent from the project. |

## `pstdio agents install-skills <agent-id>`

```sh
pstdio agents install-skills <agent-id> [--global-skills]
```

| Flag | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `--global-skills` | `boolean` | `false` | Install skills to the agent's global config directory. |

Errors:

| Error | Cause |
| ----- | ----- |
| `Unknown agent: <agent-id>. Available: ...` | Unknown agent id. |
| `Not inside a git repository. Use --global-skills or run from a git repo.` | Skill install attempted outside git without global mode. |
| `No project configured. Run \`pstdio projects init\` first.` | Skill install attempted without linked project and no global mode. |

## Verification & Evidence

- **Commands to run**: `sed -n '1,220p' packages/pstdio/src/adapters/cli/commands/agents/index.ts`, `for f in list setup update remove install-skills; do sed -n '1,220p' packages/pstdio/src/adapters/cli/commands/agents/$f.ts; done`
- **Expected evidence**: Command names, flags, setup behavior, and skill installation behavior match the documented command summary.
- **Where to find artifacts**: `packages/pstdio/src/adapters/cli/commands/agents/`
