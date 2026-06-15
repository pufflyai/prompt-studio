---
name: pstdio
description: Guidance for Prompt Studio and the pstdio CLI for managing project workflows. Covers setup, configuration (.pstdio/config.json), agent configuration, CLI reference, and troubleshooting. Use for "setting up Prompt Studio", "configuring agents", "how does pst work", "what commands are available", or general Prompt Studio questions.
metadata:
  version: 0.0.3
---

# Prompt Studio

## What is Prompt Studio?

Prompt Studio is a local-first project management tool for AI-driven development. It bridges humans and AI coding agents (OpenCode, Claude Code, Codex) by providing structured workflows for planning, delegating, tracking, and validating work.

- **Local-first** — project data lives in `.pstdio/` at the git root, synced to a database via the API
- **Agent-agnostic** — works with multiple coding agents through a standardized interface
- **CLI + Dashboard** — terminal and web UI consuming the same API
- **Project-scoped** — each project groups repos, tickets, docs, templates, workspaces, and agent configs under a single ID

### Core workflow: Plan > Delegate > Validate

1. **Plan** — Create tickets or proposals describing the work (scope, steps, acceptance criteria)
2. **Delegate** — Launch an agent session in an isolated workspace to implement a ticket
3. **Validate** — Review artifacts (tests, builds, diffs), then merge the workspace back

This skill covers Prompt Studio itself. For task-specific workflows, defer to the dedicated skills:

- **create-ticket** — Creating tickets
- **implement-ticket** — Implementing tickets
- **create-proposal** — Writing proposals
- **create-sub-tickets** — Breaking tickets into sub-tickets
- **refine-ticket** — Refining ticket content
- **create-pstdio-extension** — Creating or editing extensions that contribute commands, hooks, schedules, templates, skills, or dashboard UI

For command-specific options, run `pst <command> --help`.
For the full command and troubleshooting reference, see [references/cli-reference.md](references/cli-reference.md).

## Core Concepts

### Projects

The top-level container grouping repos, tickets, docs, templates, workspaces, and agent configs. Each project has a unique ID stored in `.pstdio/config.json`.

### Tickets

Work items (bugs, features, proposals) tracked end-to-end and owned by the `pstdio-planner` extension. Each ticket has a shorthand (e.g. `PS-12`) and a status. The canonical copy lives in the extension's storage; `.pstdio/tickets/<shorthand>/` is the local draft checkout you materialize with `pst tickets write`/`pull`, edit, and persist with `pst tickets save`. Default statuses: `Backlog`, `Ready`, `In Progress`, `Blocked`, `In Review`, `Done`. Tickets also have a `draft` flag (separate from status) that is set on creation and cleared on save.

### Skills

Markdown instruction files that teach agents how to perform project-specific workflows. Installed to agent directories (e.g. `.claude/skills/`) during setup. Skills are never overwritten — user edits are preserved.

### Templates

Reusable markdown files with `{{PLACEHOLDER}}` tokens, substituted when creating tickets or docs. Two types: **ticket templates** (scaffold new tickets) and **doc templates** (scaffold documentation pages like PRDs, ADRs, cookbooks, and lessons learned).

### Agents

External coding processes (Claude Code, OpenCode) that execute work. Prompt Studio installs skills, creates workspaces, and manages sessions for them.

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
   pst projects create [name]
   ```

   If `name` is omitted, the current folder name is used. This also enables installed default extensions and scaffolds docs.

2. **Or link to an existing project**

   ```bash
   pst projects link --project-id <id>
   ```

3. **Configure an agent**

   ```bash
   pst agents setup claude-code
   ```

   Installs the project's enabled skill catalog to the agent's skills directory (e.g. `.claude/skills/`).

4. **Verify setup**
   ```bash
   pst projects list
   pst agents list
   ```

## Configuration

### Project Config (`.pstdio/config.json`)

- **Scope**: Links the local repo to a Prompt Studio project
- **Location**: `<repo-root>/.pstdio/config.json` (checked into git)

```json
{
  "project_id": "<uuid>"
}
```

### Agent Configuration

Stored in the database. The first configured agent becomes the default.

```bash
pst agents list                # Show agents with status (configured, installed, default)
pst agents setup <agent-id>    # Configure agent, install skills
pst agents update <agent-id>   # Update config (--default, --binary, --skills-dir)
pst agents remove <agent-id>   # Remove agent (--delete-skills to also remove skill files)
pst agents install-skills <id> # Reinstall project skills (missing only, never overwrites)
```

Available agents: `claude-code`, `opencode`.

## Extensions

Extensions are the automation surface for lifecycle hooks, commands, schedules, templates, skills, and UI contributions. Built-in extensions provide planner workflows, templates, skills, workspace statuses, and user-scoped worktree setup for linked repos.

Project commands contributed by enabled extensions are routed through the extension CLI dispatcher. Run `pst extensions --help` for install and enable flows, `pst extensions check` to validate user and repo-local roots, and `pst <extension-name> --help` to inspect commands exposed by an enabled extension.

## References

- [references/cli-reference.md](references/cli-reference.md) — CLI command cheatsheet and troubleshooting playbook.
