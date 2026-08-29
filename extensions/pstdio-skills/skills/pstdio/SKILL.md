---
name: pstdio
description: Use Prompt Studio and its pst CLI. Covers project setup, .pstdio/config.json, agent setup, commands, extensions, and troubleshooting. Use for Prompt Studio questions or requests to configure a project or agent.
metadata:
  version: 0.0.7
---

# Prompt Studio

Prompt Studio is a workbench where you and your agents can build and run tailored tools for your work.

Use a dedicated skill for these tasks:

- `create-ticket` creates a ticket.
- `refine-ticket` researches and expands an existing ticket.
- `implement-ticket` implements a ticket in a managed workspace.
- `create-proposal` writes a proposal for a large or breaking change.
- `create-sub-tickets` splits a parent ticket.
- `create-pstdio-extension` creates or edits an extension.

Run `pst <command> --help` for command options. See [references/cli-reference.md](references/cli-reference.md) for the command index and troubleshooting notes.

## Main concepts

### Projects

A project groups repositories, tickets, documentation, templates, workspaces, and agent settings. Each linked repository has a project ID in `.pstdio/config.json`.

### Tickets

A ticket is a bug, feature, proposal, or other work item owned by the `pstdio-planner` extension. Each ticket has a shorthand such as `PS-12`, a status, and a separate `draft` flag.

The extension store holds the saved ticket. `pst tickets write` or `pst tickets pull` creates a local checkout at `.pstdio/tickets/<shorthand>/`. Edit that checkout, then run `pst tickets save` to persist it.

### Skills

Skills are Markdown instructions for project workflows. `pst agents setup` installs enabled skills into an agent's skill directory. Prompt Studio does not overwrite an existing skill with the same name.

### Agents

Agents are external coding tools such as Claude Code, Codex, and OpenCode. Prompt Studio detects available agents, installs skills for them, and starts sessions through their harness extensions.

### Workspaces

A workspace is an isolated git worktree for one ticket attempt. Its shorthand has the form `<ticket>_A<n>`, for example `PS-12_A1`. Prompt Studio squash-merges approved work back into the source branch.

### Sessions

A session records a conversation with an agent. It can belong to a workspace and ticket. Session status is one of `in_progress`, `awaiting_input`, `completed`, `failed`, or `cancelled`.

## Project files

```
.pstdio/
├── config.json           # Link to the Prompt Studio project
├── tickets/              # Local ticket files
│   └── <id>_<slug>/
│       ├── ticket.md     # Ticket content (YAML frontmatter + markdown)
│       └── files/        # Planning files for the ticket
├── reports/              # Agent reports and evidence
│   └── <name>/
│       ├── report*.md    # Numbered report content created with pst reports write
│       └── files*/       # Test output, logs, screenshots, and other evidence
└── skills/               # Project-level skill overrides
```

## Set up a project

Create a project for the current repository:

```bash
pst projects create [name]
```

When `name` is absent, Prompt Studio uses the current folder name. The command also enables the installed default extensions and creates the documentation tree.

To link the repository to an existing project:

```bash
pst projects link --project-id <id>
```

Configure an agent and install its project skills:

```bash
pst agents setup <agent-id>
```

Check the setup:

```bash
pst projects list
pst agents list
```

## Configuration

### Project configuration

`<repo-root>/.pstdio/config.json` links the repository to a Prompt Studio project:

```json
{
  "project_id": "<uuid>"
}
```

### Agent configuration

Prompt Studio stores agent settings in the database. The first configured agent becomes the default.

```bash
pst agents list                 # Show detected and configured agents
pst agents setup <agent-id>     # Configure an agent and install skills
pst agents install-skills <id>  # Install missing project skills
```

## Extensions

Extensions add commands, hooks, schedules, templates, skills, agent harnesses, workspace types, and dashboard UI.

Use `pst extensions dev <path>` while editing a local extension. Run `pst extensions check` to validate installed user and repository extensions. Run `pst extensions update [name]` to apply host-managed updates to the linked project. Run `pst <extension-name> --help` to inspect an enabled extension's commands.

## References

- [CLI reference and troubleshooting](references/cli-reference.md)
