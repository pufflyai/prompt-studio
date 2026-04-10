---
name: pstdio
description: Guidance for pstdio, a CLI tool for managing project workflows. Covers setup, configuration (.pstdio/config.json), agent configuration, CLI reference, and troubleshooting. Use for "setting up pstdio", "configuring agents", "how does pstdio work", "what commands are available", or general pstdio questions.
metadata:
  - version: 0.0.2
---

# pstdio

## What is pstdio?

Prompt Studio (pstdio) is a local-first project management tool for AI-driven development. It bridges humans and AI coding agents (OpenCode, Claude Code, Codex) by providing structured workflows for planning, delegating, tracking, and validating work.

- **Local-first** — project data lives in `.pstdio/` at the git root, synced to a database via the API
- **Agent-agnostic** — works with multiple coding agents through a standardized interface
- **CLI + Dashboard** — terminal and web UI consuming the same API
- **Project-scoped** — each project groups repos, tickets, docs, templates, workspaces, and agent configs under a single ID

### Core workflow: Plan > Delegate > Validate

1. **Plan** — Create tickets or proposals describing the work (scope, steps, acceptance criteria)
2. **Delegate** — Launch an agent session in an isolated workspace to implement a ticket
3. **Validate** — Review artifacts (tests, builds, diffs), then merge the workspace back

This skill covers pstdio itself. For task-specific workflows, defer to the dedicated skills:

- **create-ticket** — Creating tickets
- **implement-ticket** — Implementing tickets
- **create-proposal** — Writing proposals
- **create-sub-tickets** — Breaking tickets into sub-tickets
- **refine-ticket** — Refining ticket content
- **write-pstdio-hook** — Writing or editing lifecycle hooks

For command-specific options, run `pstdio <command> --help`.
For the full command and troubleshooting reference, see [references/cli-reference.md](references/cli-reference.md).

## Core Concepts

### Projects

The top-level container grouping repos, tickets, docs, templates, workspaces, and agent configs. Each project has a unique ID stored in `.pstdio/config.json`.

### Tickets

Work items (bugs, features, proposals) tracked end-to-end. Each ticket has a shorthand (e.g. `PS-12`), a status, and lives as a directory under `.pstdio/tickets/`. Default statuses: `backlog`, `ready`, `wip`, `blocked`, `review`, `done`. Tickets also have a `draft` flag (separate from status) that is set on creation and cleared on save.

### Skills

Markdown instruction files that teach agents how to perform project-specific workflows. Installed to agent directories (e.g. `.claude/skills/`) during setup. Skills are never overwritten — user edits are preserved.

### Templates

Reusable markdown files with `{{PLACEHOLDER}}` tokens, substituted when creating tickets or docs. Two types: **ticket templates** (scaffold new tickets) and **doc templates** (scaffold documentation pages like PRDs, ADRs, cookbooks, and lessons learned).

### Agents

External coding processes (Claude Code, OpenCode) that execute work. pstdio installs skills, creates workspaces, and manages sessions for them.

### Workspaces

Isolated git worktrees where agents work, one per ticket attempt. Shorthand: `<ticket>_A<n>` (e.g. `PS-12_A1`). Changes are squash-merged back when approved.

### Sessions

Conversations between users and agents, tracked in the database. Sessions can be linked to workspaces and tickets. Statuses: `in_progress`, `awaiting_input`, `completed`, `failed`, `cancelled`.

## Project Structure

```
.pstdio/
├── config.json           # Project configuration (project_id)
├── tickets/              # Local ticket files
│   └── <id>_<slug>/
│       ├── ticket.md     # Ticket content (YAML frontmatter + markdown)
│       ├── artifacts/    # Agent-generated artifacts (tests, builds, logs)
│       └── files/        # Supporting files (research, screenshots)
├── docs/                 # Project documentation
│   ├── navigation.json   # Sidebar structure
│   └── /**/*.md          # Documentation pages
├── templates/            # Project-level template overrides
├── skills/               # Project-level skill overrides
└── prompts/              # Project-level prompt template overrides
```

## Setting Up a Project

1. **Create a new project**

   ```bash
   pstdio projects create [name]
   ```

   If `name` is omitted, the current folder name is used. This also installs default skills, seeds templates, and scaffolds docs.

2. **Or link to an existing project**

   ```bash
   pstdio projects link --project-id <id>
   ```

3. **Configure an agent**

   ```bash
   pstdio agents setup claude-code
   ```

   Installs bundled skills to the agent's skills directory (e.g. `.claude/skills/`).

4. **Verify setup**
   ```bash
   pstdio projects list
   pstdio agents list
   ```

## Configuration

### Project Config (`.pstdio/config.json`)

- **Scope**: Links the local repo to a pstdio project
- **Location**: `<repo-root>/.pstdio/config.json` (checked into git)

```json
{
  "project_id": "<uuid>"
}
```

### Agent Configuration

Stored in the database. The first configured agent becomes the default.

```bash
pstdio agents list                # Show agents with status (configured, installed, default)
pstdio agents setup <agent-id>    # Configure agent, install skills
pstdio agents update <agent-id>   # Update config (--default, --binary, --skills-dir)
pstdio agents remove <agent-id>   # Remove agent (--delete-skills to also remove skill files)
pstdio agents install-skills <id> # Reinstall bundled skills (missing only, never overwrites)
```

Available agents: `claude-code`, `opencode`.

## Creating Hooks

Hooks are defined via SDK plugins in `.pstdio/plugins/`. Use `definePlugin` from `@pstdio/sdk/plugins` to create TypeScript/JavaScript plugins that respond to lifecycle events. Git-level hooks (commit, merge, rebase) are shell scripts also stored in `.pstdio/plugins/`. You can also create and edit hooks through the dashboard at `Project Settings > Hooks`.

Use `pstdio hooks list` to see the supported hook names and whether each one is already installed. Current hook names:

- **Worktree**: `pre-worktree-create`, `post-worktree-create`, `pre-commit`, `post-commit`, `pre-rebase`, `post-rebase`, `pre-merge`, `post-merge`, `pre-worktree-remove`, `post-worktree-remove`, `on-conflict`
- **Session**: `post-session-start`, `post-session-success`, `post-session-fail`, `post-session-resume`, `post-session-await-input`
- **Ticket**: `pre-ticket-creation`, `post-ticket-creation`, `pre-ticket-status-change`, `post-ticket-status-change`, `pre-ticket-archive`, `post-ticket-archive`, `pre-ticket-deletion`, `post-ticket-deletion`

Recommended workflow:

1. Run `pstdio hooks list` to pick the correct hook name and confirm whether a hook already exists.
2. Create a plugin file in `.pstdio/plugins/` using `definePlugin`. For git-level hooks (commit, merge, rebase), use `pstdio hooks create <hook-name>` to scaffold a shell script.
3. Plugin hooks receive a typed context object (`ctx`) with all event data. Shell hooks receive env vars such as `PSTDIO_HOOK`, `PSTDIO_REPO_PATH`, and `PSTDIO_PROJECT_ID`.
4. For blocking hooks (`pre-*`), return `{ reject: true, reason: "..." }` from plugins, or `exit 1` from shell scripts, to abort the parent operation.
5. Test shell hooks manually with `pstdio hooks run <hook-name> [--worktree-path <path>]` before relying on them in normal workflows.

Example plugin:

```ts
// .pstdio/plugins/ticket-lifecycle.ts
import { definePlugin, setTicketStatus } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postSessionStart(ctx) {
      if (!ctx.ticket) return;
      await setTicketStatus(ctx, { ticket: ctx.ticket.shorthand, status: "wip" });
    },
  },
});
```

Example shell hook (git-level):

```sh
#!/bin/sh

# .pstdio/plugins/pre-commit
bun run validate
```

Current behavior to keep in mind:

- Lifecycle hooks use SDK plugins in `.pstdio/plugins/` — TypeScript/JavaScript modules loaded via `import()`.
- Git-level hooks (commit, merge, rebase) are shell scripts in `.pstdio/plugins/`, executed with `sh <script-path>`.
- `pstdio hooks create` fails instead of overwriting an existing hook file.
- Hooks time out after 60 seconds.
- Use `.pstdio/docs/product/cli/hooks.md` for the detailed CLI and lifecycle reference.

## References

- [references/cli-reference.md](references/cli-reference.md) — CLI command cheatsheet and troubleshooting playbook.
