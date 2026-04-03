---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Agents

## Summary

The `pstdio agents` command group configures agent integrations and installs bundled skills and plugin artifacts for those agents.

## Command Summary

| Command | Purpose |
| ------- | ------- |
| `pstdio agents list` | List available agents and whether they are configured, installed, and default. |
| `pstdio agents setup <agent-id>` | Configure one agent and install skills for it. |
| `pstdio agents update <agent-id>` | Update agent config fields (`--default`, `--binary`, `--skills-dir`). |
| `pstdio agents remove <agent-id>` | Remove a configured agent. |
| `pstdio agents install-skills <agent-id>` | Install bundled skills for an agent without reconfiguring it. |
| `pstdio agents install-plugins <agent-id>` | Install bundled plugin artifacts for an agent without reconfiguring it. |

## Detailed Behavior

## `pstdio agents list`

### Usage

```sh
pstdio agents list
```

### Output

Prints a table with columns:

- `Agent`
- `Configured` (`yes`/`no`)
- `Installed` (`yes`/`no`, detected via `which <binary>`)
- `Default` (`yes` for the default agent)

## `pstdio agents setup <agent-id>`

### Usage

```sh
pstdio agents setup <agent-id> [--global-skills] [--global-plugins]
```

### Flags

| Flag | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `--global-skills` | `boolean` | `false` | Install skills to the agent's global config directory instead of the current project. |
| `--global-plugins` | `boolean` | `false` | Install plugins to the agent's global config directory instead of the current project. |

### Behavior

1. Validate `agent-id` against known agents.
2. Configure the agent via API.
3. Install bundled skills for that agent.
4. Install bundled plugin artifacts when the agent requires them (`opencode`).
5. If run outside git and both `--global-skills` and `--global-plugins` are unset, print a skip message and stop installation.
6. If run without a linked project and `--global-skills` is unset, print a skills skip message but still attempt plugin install.

## `pstdio agents update <agent-id>`

### Usage

```sh
pstdio agents update <agent-id> [--default] [--binary <path>] [--skills-dir <path>]
```

### Flags

| Flag | Type | Description |
| ---- | ---- | ----------- |
| `--default` | `boolean` | Set as default agent. |
| `--binary` | `string` | Override agent binary path. |
| `--skills-dir` | `string` | Override agent skills directory. |

## `pstdio agents remove <agent-id>`

### Usage

```sh
pstdio agents remove <agent-id> [--delete-skills]
```

### Flags

| Flag | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `--delete-skills` | `boolean` | `false` | Also remove bundled skills for this agent from the project. |

## `pstdio agents install-skills <agent-id>`

### Usage

```sh
pstdio agents install-skills <agent-id> [--global-skills]
```

### Flags

| Flag | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `--global-skills` | `boolean` | `false` | Install skills to the agent's global config directory. |

### Errors

| Error | Cause |
| ----- | ----- |
| `Unknown agent: <agent-id>. Available: ...` | Unknown agent id. |
| `Not inside a git repository. Use --global-skills or run from a git repo.` | Skill install attempted outside git without global mode. |
| `No project configured. Run \`pstdio projects init\` first.` | Skill install attempted without linked project and no global mode. |

## `pstdio agents install-plugins <agent-id>`

### Usage

```sh
pstdio agents install-plugins <agent-id> [--global-plugins]
```

### Flags

| Flag | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `--global-plugins` | `boolean` | `false` | Install plugins to the agent's global config directory. |

### Behavior

1. Validate `agent-id` against known agents.
2. If the agent does not require plugin artifacts (for example `claude-code`), print a no-op message and exit.
3. Install bundled plugin artifacts into `.opencode/plugins` in the current project by default.
4. With `--global-plugins`, install into `~/.opencode/plugins`.
5. Installation is idempotent and does not overwrite an existing plugin file.

### Errors

| Error | Cause |
| ----- | ----- |
| `Unknown agent: <agent-id>. Available: ...` | Unknown agent id. |
| `Not inside a git repository. Use --global-plugins or run from a git repo.` | Plugin install attempted outside git without global mode. |

## OpenCode Session Bridge

`opencode` uses a shared `opencode serve` process, so process env alone is not a reliable per-session channel.

pstdio installs a bundled OpenCode `shell.env` plugin artifact:

- local path: `.opencode/plugins/pstdio-session-bridge.js`
- global path (`--global-plugins`): `~/.opencode/plugins/pstdio-session-bridge.js`

Bridge behavior:

1. Read optional OpenCode hook input `sessionID` and `callID`.
2. Run `pstdio sessions resolve-session-id --agent opencode --agent-session-id <sessionID> --json`.
3. Export `PSTDIO_SESSION_ID` when mapping succeeds.
4. Keep shell execution non-blocking when `sessionID` is missing or mapping fails.

### Troubleshooting

1. Reinstall plugin artifacts:
   `pstdio agents install-plugins opencode`
2. For global setup:
   `pstdio agents install-plugins opencode --global-plugins`
3. Verify plugin file exists:
   `.opencode/plugins/pstdio-session-bridge.js` (or `~/.opencode/plugins/pstdio-session-bridge.js`)
4. If `PSTDIO_SESSION_ID` is missing, verify your OpenCode path emits `sessionID` in `shell.env`.
5. `callID` and `sessionID` are optional in some OpenCode execution paths, so unresolved commands can still run untagged by design.

## Verification & Evidence

- **Commands to run**: `sed -n '1,220p' packages/pstdio/src/adapters/cli/commands/agents/index.ts`, `for f in list setup update remove install-skills install-plugins; do sed -n '1,220p' packages/pstdio/src/adapters/cli/commands/agents/$f.ts; done`
- **Expected evidence**: Command names, flags, setup/install behavior, and OpenCode bridge notes match the documented command summary.
- **Where to find artifacts**: `packages/pstdio/src/adapters/cli/commands/agents/`
