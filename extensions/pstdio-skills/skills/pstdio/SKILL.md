---
name: pstdio
description: Use Prompt Studio and its pst CLI. Covers project setup, .pstdio/config.json, agent setup, commands, extensions, and troubleshooting. Use for Prompt Studio questions, requests to configure a project or agent, or when the shell cannot find the pst command.
metadata:
  version: 0.0.9
---

# Prompt Studio

Prompt Studio is a workbench where you and your agents can build and run tailored tools for your work. Tools are extensions. The public documentation is at [prompt.studio/docs](https://prompt.studio/docs/).

Use a dedicated skill for these tasks:

- `create-ticket` creates a ticket.
- `refine-ticket` researches and expands an existing ticket.
- `implement-ticket` implements a ticket in a managed workspace.
- `create-proposal` writes a proposal for a large or breaking change.
- `create-sub-tickets` splits a parent ticket.
- `create-pstdio-extension` creates or edits an extension.

Run `pst <command> --help` for the options of the installed version. See [references/cli-reference.md](references/cli-reference.md) for the command index and troubleshooting.

## Main concepts

### Projects

A project opens one folder. It owns the extensions turned on for it, the data those extensions save, and its workspaces and sessions. Git is optional. The folder's `.pstdio/config.json` links it to the project, and `pst` commands use the nearest one. See [Projects and workspaces](https://prompt.studio/docs/guides/concepts/projects-and-workspaces/).

### Workspaces

A workspace is where sessions run. Every project has a default workspace: for a local project, that is the project folder itself. Sessions there share the same files, with no separate branch.

Other workspaces come from providers. A Git worktree workspace is a separate folder on its own branch; a remote workspace runs on another machine. Short names identify them:

| Short name | Workspace |
| --- | --- |
| `default` | The project's default workspace |
| `WS-1`, `WS-2`, ... | Standalone workspaces, such as those `pst workspaces create` makes |
| `PS-12_A1`, `PS-12_A2`, ... | Workspaces a tool creates for one item, such as Planner attempts at ticket `PS-12` |

`pst workspaces merge` squash-merges a Git workspace into the current branch. `pst workspaces delete` removes a workspace; for a Git worktree this also removes its branch and any uncommitted changes. Planner also deletes linked workspaces when their tickets are archived or deleted, unless the project turns that setting off. Check `git status` in a workspace before any of these. See [Workspaces](https://prompt.studio/docs/references/cli/workspaces/).

### Sessions

A session is one agent conversation. It runs in one workspace and can be linked to a ticket. Its status is one of:

| Status | Meaning |
| --- | --- |
| `queued` | Accepted and waiting for a free agent slot. It starts on its own, in order. |
| `in_progress` | The agent is working. A follow-up sent during a turn waits in the session's queue. |
| `awaiting_input` | The agent asked for an approval or an answer. |
| `completed`, `failed`, `cancelled` | The turn ended. |
| `disconnected` | The host lost the agent process and could not reattach. A follow-up resumes the session. |

See [Sessions](https://prompt.studio/docs/references/cli/sessions/).

### Agents

Agents are external coding tools such as Claude Code, Codex, and OpenCode. Harness extensions connect them. A new session uses the agent you pass with `--agent`. Without it, the session uses the project's default agent from the project settings, and then the first available agent. `pst agents setup` does not choose a default. See [Agents and harnesses](https://prompt.studio/docs/guides/concepts/agents/).

### Skills

Skills are Markdown instructions for agents. Their source is an enabled extension or the project. Agent skill folders, such as `.agents/skills/` or `.claude/skills/`, hold installed copies.

- `pst agents setup <agent-id>` and `pst agents install-skills <agent-id>` install only skills whose folder is missing. They keep existing folders unchanged and list them as kept.
- `pst agents install-skills <agent-id> --force` replaces the folder of each enabled skill with the source and discards local edits in it. It never touches folders of skills that are not enabled. `setup` has no `--force`.
- Automatic sync during workspace setup updates only files Prompt Studio wrote that are still unchanged. It keeps edited files and same-name files it did not write. Delete a kept file to let the next sync write the current version.

To change a skill for good, edit its source, not the installed copy. See [Agents](https://prompt.studio/docs/references/cli/agents/).

### Tickets

Tickets belong to the Planner extension (`pstdio-planner`). Each ticket has a shorthand such as `PS-12`, a status, and a separate draft flag. `pst tickets write` or `pst tickets pull` writes a local copy under `.pstdio/extension-storage/pstdio-planner/tickets/<shorthand>/` in the project folder. Use the absolute `path` the command returns, even from another workspace, then run `pst tickets save`. See [Planner](https://prompt.studio/docs/extensions/planner/).

## Project files

```
.pstdio/
├── config.json                  # Link to the project
├── extensions/                  # Repo-scoped extension source
└── extension-storage/           # All extension-owned project files
    ├── pstdio-planner/tickets/  # Ticket copies and planning files
    ├── pstdio-reports/reports/  # Reports and evidence
    └── pstdio-artifacts/        # Artifact drafts and prototypes
```

Each extension keeps its configuration, caches, drafts, and evidence in its own folder under `extension-storage/`. Use the paths that extension commands return.

Prompt Studio does not create documentation folders. A repository keeps its own documentation wherever its contributors chose; read the repository's README or contributor rules to find it.

## Set up a project

From the folder you want to open:

```bash
pst projects create [name]
```

Without a name, the folder name is used. The exact current folder becomes the project. Opening a folder that is already a project reuses it; a child folder is a separate project. New projects get the default extensions from the catalog. The command prints a warning for any that could not be set up. See [Open a project](https://prompt.studio/docs/guides/getting-started/open-a-project/).

Install the skills for an agent, then check the setup:

```bash
pst agents setup <agent-id>
pst projects list
pst agents list
```

## Extensions

Extensions add commands, hooks, schedules, templates, skills, agent harnesses, workspace types, and dashboard UI.

- `pst <extension-name> --help` lists an enabled extension's commands.
- `pst extensions add <name-or-absolute-path>` installs from the catalog or a local folder. Run it inside the linked project.
- `pst extensions check` checks installed extensions on the host; `pst extensions check <source>` checks a local source folder.
- `pst extensions update [name]` applies host-managed updates.
- To build or change an extension, use the `create-pstdio-extension` skill.

See [Add tools](https://prompt.studio/docs/guides/getting-started/add-tools/).

## References

- [CLI reference and troubleshooting](references/cli-reference.md), including what to do when the shell cannot find `pst`
- [Troubleshooting](https://prompt.studio/docs/guides/getting-started/troubleshooting/)
