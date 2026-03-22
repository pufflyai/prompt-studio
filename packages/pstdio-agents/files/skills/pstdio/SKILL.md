---
name: pstdio
description: Guidance for pstdio, a CLI tool for managing project workflows. Covers setup, configuration (.pstdio/config.json), agent configuration, CLI reference, and troubleshooting. Use for "setting up pstdio", "configuring agents", "how does pstdio work", "what commands are available", or general pstdio questions.
---

<!-- pstdio-skill-version: 0.0.1 -->

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
- **update-documentation** — Managing project documentation
- **review-ticket** — Reviewing tickets
- **refine-ticket** — Refining ticket content

For command-specific options, run `pstdio <command> --help`.

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

## CLI Reference

### Projects

```bash
pstdio projects create [name]              # Create project, scaffold .pstdio/
pstdio projects link --project-id <id>     # Link repo to existing project
pstdio projects unlink                     # Unlink repo from project
pstdio projects list                       # List all projects
pstdio projects view [--project-id <id>]   # View project details
pstdio projects repos [--project-id <id>]  # List linked repos
pstdio projects delete <project-id>        # Delete a project
```

#### Startup Scripts

```bash
pstdio projects startup-script set [--file <path>]  # Set startup script (reads stdin if no --file)
pstdio projects startup-script get                  # Print startup script
pstdio projects startup-script clear                # Clear startup script
```

### Agents

```bash
pstdio agents list                                  # List agents with status
pstdio agents setup <agent-id> [--global-skills]    # Configure + install skills
pstdio agents update <agent-id> [--default] [--binary <path>] [--skills-dir <path>]
pstdio agents remove <agent-id> [--delete-skills]   # Remove agent config
pstdio agents install-skills <agent-id> [--global-skills]  # Reinstall missing skills
```

### Tickets

```bash
pstdio tickets write --title "<title>" [--user-prompt "<desc>"] [--template <name>] [--status <s>] [--tag <t>] [--parent-id <id>]
pstdio tickets create --content "<title>" [--status <s>] [--tag <t>]
pstdio tickets list [--status <s>] [--tag <t>] [--parent-id <id>] [--archived] [--draft]
pstdio tickets pull [--id <id>] [--force]            # Pull one or all non-archived tickets
pstdio tickets update --id <id> [--status <s>] [--tag <t>]
pstdio tickets save --id <id> [--status <s>] [--tag <t>]
pstdio tickets implement --id <id>                   # Set wip + launch agent
pstdio tickets files --id <id>                       # List ticket files
pstdio tickets workspaces --id <id>                  # List ticket workspaces
pstdio tickets archive --id <id>                     # Archive ticket
pstdio tickets delete --id <id>                      # Delete ticket
```

### Sessions

```bash
pstdio sessions create --prompt "<prompt>" [--title "<t>"] [--workspace-id <id>] [--agent <a>] [--model <m>]
pstdio sessions list [--status <s>] [--agent <a>] [--workspace-id <id>] [--archived]
pstdio sessions view --id <id>                       # View session details
pstdio sessions follow-up --id <id> --prompt "<p>" [--agent <a>] [--model <m>]
pstdio sessions stream --id <id>                     # Tail live session output
pstdio sessions approve --id <id> --approval-id <aid>  # Approve tool permission
pstdio sessions deny --id <id> --approval-id <aid>     # Deny tool permission
pstdio sessions stop --id <id>                       # Stop session
pstdio sessions archive --id <id>                    # Archive session
```

### Workspaces

```bash
pstdio workspaces create --id <ticket-id> [--base <ref>]  # Create worktree for ticket
pstdio workspaces list                               # List active workspaces
pstdio workspaces merge --id <ws-id> [--delete-workspace]  # Squash-merge into current branch
pstdio workspaces delete --id <ws-id>                # Force-remove workspace
pstdio workspaces startup-log --id <ws-id>           # Show startup script log
```

### Templates

```bash
pstdio templates list                                # List all templates
pstdio templates create --name <n> --type <prompt|ticket|document> --file <path> [--default]
pstdio templates update --name <n> [--file <path>] [--default]
pstdio templates write --name <n> --target <ticket-id|docs/path>
pstdio templates delete --name <n>
```

Bundled ticket templates: `ticket`, `proposal`.
Bundled doc templates: `prd`, `adr`, `cookbook`, `review-me`, `lessons-learned`.

### Statuses & Tags

```bash
pstdio statuses list                                 # List ticket statuses
pstdio statuses create --name <n> --color <c> [--default]
pstdio statuses set-default --name <n>
pstdio statuses delete --name <n>

pstdio tags list                                     # List tags
pstdio tags create --name <n> --color <c>
pstdio tags delete --name <n>
```

Colors: gray, red, orange, amber, yellow, lime, green, teal, cyan, blue, indigo, violet, purple, pink, rose.

### Documentation

```bash
pstdio docs init       # Initialize .pstdio/docs/ structure
```

### Server & Dashboard

```bash
pstdio serve [--port <n>]                            # Start API server (default: 19840)
pstdio close                                         # Stop background API
pstdio [--api-port <n>] [--dashboard-port <n>]       # Launch dashboard + open browser
```

## Troubleshooting

- **"Project not found"**: Run `pstdio projects list` to verify the project exists, then `pstdio projects link --project-id <id>`.
- **Skills not installed**: Run `pstdio agents install-skills <agent-id>` to reinstall missing skills.
- **Config missing**: Check that `.pstdio/config.json` exists at the git root. Create with `pstdio projects create` or `pstdio projects link`.
- **API not reachable**: Run `pstdio serve` to start the API manually, or check if it's already running on the expected port.
- **Agent not found**: Run `pstdio agents list` to check availability. Ensure the agent binary is installed and on your PATH.
- **Workspace issues**: Run `pstdio workspaces list` to see active workspaces. Use `--force` with `workspaces delete` if a worktree is stuck.
