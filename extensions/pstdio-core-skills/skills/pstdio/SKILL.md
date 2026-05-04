---
name: pstdio
description: Guidance for pstdio, a CLI tool for managing project workflows. Covers setup, configuration (.pstdio/config.json), agent configuration, CLI reference, and troubleshooting. Use for "setting up pstdio", "configuring agents", "how does pstdio work", "what commands are available", or general pstdio questions.
metadata:
  - version: 0.0.3
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
- **create-pstdio-plugin** — Writing or editing plugins (hooks that react to lifecycle events, actions that expose user-triggered commands)

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

## Plugins

Plugins live in `.pstdio/plugins/` and subscribe to lifecycle hooks. Each plugin is a TypeScript (or JavaScript) module with a default export built from `definePlugin` (imported from `@pstdio/sdk/plugins`). See the **create-pstdio-plugin** skill for the full authoring guide.

Plugins are auto-discovered from `.pstdio/plugins/` at runtime. `pstdio plugins list` shows loaded plugins for the current project. `pstdio plugins register` force-registers the directory if a cached process needs to pick up changes.

Available hooks (by category, in SDK camelCase):

- **Worktree**: `preWorktreeCreate`, `postWorktreeCreate`, `preWorktreeRemove`, `postWorktreeRemove`
- **Commit / Rebase / Merge**: `preCommit`, `postCommit`, `preRebase`, `postRebase`, `preMerge`, `postMerge`, `onConflict`
- **Session**: `postSessionStart`, `postSessionSuccess`, `postSessionFail`, `postSessionResume`, `postSessionAwaitInput`
- **Ticket**: `preTicketCreation`, `postTicketCreation`, `preTicketStatusChange`, `postTicketStatusChange`, `preTicketArchive`, `postTicketArchive`, `preTicketDeletion`, `postTicketDeletion`
- **Attempt status**: `preAttemptStatusChange`, `postAttemptStatusChange`

Example plugin:

```ts
// .pstdio/plugins/ticket-lifecycle.ts
import { definePlugin, setTicketStatus } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postSessionStart(ctx) {
      if (!ctx.ticket) return;
      await setTicketStatus(ctx, {
        ticket: ctx.ticket.shorthand,
        status: "wip",
      });
    },
  },
});
```

Pre-hooks can reject the parent operation by returning `{ reject: true, reason: "..." }`. Post-hooks return `void`.

## References

- [references/cli-reference.md](references/cli-reference.md) — CLI command cheatsheet and troubleshooting playbook.
