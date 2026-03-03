# CLI: `pstdio agents`

Manage coding agents connected to the project.

Connected agents determine which skill directories are populated during project setup (e.g. `.claude/skills`, `.opencode/skills`).

---

## `pstdio agents list`

Show all known agents and their current status.

```
pstdio agents list
```

**Flags:** none

**Output:**

```
Agent        Status       Configured   Default
claude-code  INSTALLED    yes          *
opencode     NOT_FOUND    no
```

- **Status** — `INSTALLED` if the agent binary is found on `$PATH`, `NOT_FOUND` otherwise.
- **Configured** — whether the agent has been set up for this project.
- **Default** — `*` marks the default agent.

---

## `pstdio agents setup`

Add one or more agents to the project configuration and install skills into their directories.

```
pstdio agents setup <agents...>
```

**Positional arguments:**

| Name     | Type       | Required | Description                                                               |
| -------- | ---------- | -------- | ------------------------------------------------------------------------- |
| `agents` | `string[]` | yes      | One or more agent IDs to set up. Valid values: `claude-code`, `opencode`. |

**Flags:**

| Flag            | Type      | Default | Description                                           |
| --------------- | --------- | ------- | ----------------------------------------------------- |
| `--set-default` | `boolean` | `false` | Mark the last agent in the list as the default agent. |

**Behavior:**

1. Validate each agent ID. Exit with an error if any are unknown.
2. For each agent, check availability. Warn (do not fail) if the binary is not installed.
3. Configure each agent. The first agent ever configured automatically becomes the default.
4. If `--set-default` is provided, set the last agent in the list as the new default.
5. Install bundled skills into each configured agent's skills directory.

**Output:**

```
Configured agents: claude-code, opencode
Default agent: claude-code
Skills installed at: .claude/skills, .opencode/skills
```

**Errors:**

- `"Unknown agent: codex. Valid agents: claude-code, opencode"` — invalid agent ID.
- `"Not inside a git repository. Run 'git init' first."` — no git root found.

---

## `pstdio agents remove`

Remove one or more agents from the project configuration.

```
pstdio agents remove <agents...>
```

**Positional arguments:**

| Name     | Type       | Required | Description                                                                 |
| -------- | ---------- | -------- | --------------------------------------------------------------------------- |
| `agents` | `string[]` | yes      | One or more agent IDs to remove. Valid values: `claude-code`, `opencode`.   |

**Flags:**

| Flag              | Type      | Default | Description                                                                     |
| ----------------- | --------- | ------- | ------------------------------------------------------------------------------- |
| `--delete-skills` | `boolean` | `false` | Also delete the agent's skills directory (e.g. `.claude/skills`) from the repo. |

**Behavior:**

1. Validate each agent ID.
2. Remove each agent from the configuration. If the removed agent was the default, the oldest remaining agent becomes the new default.
3. If `--delete-skills` is set, delete the agent's skills directory from the repo root.

**Output:**

```
Removed agents: opencode
```

If the default changed:

```
Removed agents: claude-code
New default agent: opencode
```

**Errors:**

- `"Agent not configured: opencode"` — trying to remove an agent that isn't set up.
- `"Cannot remove the last configured agent."` — at least one agent must remain.

---

## Known Agents

| ID            | Display Name | Binary     | Skills Directory   |
| ------------- | ------------ | ---------- | ------------------ |
| `claude-code` | Claude Code  | `claude`   | `.claude/skills`   |
| `opencode`    | OpenCode     | `opencode` | `.opencode/skills` |
