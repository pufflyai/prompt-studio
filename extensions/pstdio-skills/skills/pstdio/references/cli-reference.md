# pstdio CLI Reference

## Contents

- Projects
- Agents
- Tickets
- Sessions
- Workspaces
- Reports
- Templates
- Statuses and tags
- Server and dashboard
- Troubleshooting

## Projects

```bash
pst projects create [name]              # Create project, scaffold .pstdio/
pst projects link --project-id <id>     # Link repo to existing project
pst projects unlink                     # Unlink repo from project
pst projects list                       # List all projects
pst projects view [--project-id <id>]   # View project details
pst projects repos [--project-id <id>]  # List linked repos
pst projects delete <project-id>        # Delete a project
```

## Agents

```bash
pst agents list                                  # List agents with status
pst agents setup <agent-id> [--global-skills]
pst agents update <agent-id> [--default] [--binary <path>] [--skills-dir <path>]
pst agents remove <agent-id> [--delete-skills]   # Remove agent config
pst agents install-skills <agent-id> [--global-skills]   # Reinstall missing skills
```

## Tickets

```bash
pst tickets write --title "<title>" [--user-prompt "<desc>"] [--status <s>] [--tags <t>] [--parent <shorthand>]
pst tickets create --content "<markdown>" [--status <s>] [--tags <t>] [--parent <shorthand>]
pst tickets list [--status <s>] [--tags <t>] [--parent <shorthand>] [--archived] [--draft]
pst tickets pull [--id <id>] [--force]                 # Pull one or all non-archived tickets
pst tickets update --id <id> [--content <md>] [--status <s>] [--tags <t>] [--parent <shorthand>] [--unlink-parent] [--blocked-reason <text>]
pst tickets save --id <id> [--status <s>]              # Tags/parent/depends_on come from the edited ticket.md frontmatter
pst tickets view [field] --id <id> [--project-id <id>] # View ticket (or a single field)
pst tickets implement --id <id>                        # Set wip + launch agent
pst tickets files --id <id>                            # List ticket files
pst tickets workspaces --id <id> [--json]              # List workspaces linked to ticket
pst tickets worktrees list --id <id> [--json]          # List active worktrees for ticket
pst tickets worktrees remove-all --id <id>             # Remove all worktrees for ticket
pst tickets update-when-attempt-status --id <id> --all-attempts-status <s> --set-status <s>
pst tickets archive --id <id>                          # Archive ticket
pst tickets delete --id <id>                           # Delete ticket
```

`tickets view` accepts an optional positional field (`status`, `title`, `tags`, `shorthand`, `parent-ticket`, `sub-tickets`) to print only that value.

`tickets update-when-attempt-status` is the safe way to transition a ticket once every attempt has reached a given attempt status — use it from hooks or agents instead of direct `tickets update --status`.

## Sessions

```bash
pst sessions create --prompt "<prompt>" [--title "<t>"] [--workspace-id <id>] [--agent <a>] [--model <m>]
pst sessions list [--status <s>] [--agent <a>] [--workspace-id <id>] [--archived]
pst sessions view --id <id>                       # View session details
pst sessions follow-up --id <id> --prompt "<p>" [--agent <a>] [--model <m>]
pst sessions stream --id <id>                     # Tail live session output
pst sessions approve --id <id> --approval-id <aid>  # Approve tool permission
pst sessions deny --id <id> --approval-id <aid>     # Deny tool permission
pst sessions stop --id <id>                       # Stop session
pst sessions archive --id <id>                    # Archive session
```

## Workspaces

```bash
pst workspaces create --id <shorthand> [--base <ref>]  # Create worktree for ticket
pst workspaces list                                    # List active workspaces
pst workspaces list-statuses [--project-id <id>] [--json]  # List available attempt statuses
pst workspaces merge --id <ws-id> [--delete-workspace] # Squash-merge into current branch
pst workspaces set-status [--workspace <shorthand>] --status <s> [--session-id <id>]
pst workspaces delete --id <ws-id>                     # Force-remove workspace
```

Default attempt statuses: `wip`, `blocked`, `review-ready`, `reviewed`, `changes-requested`.

Status rule:

- During creation/planning, `pst tickets update --status ...` is valid.
- During and after implementation, prefer `pst workspaces set-status` and avoid direct ticket status updates.
- For agent-driven transitions, pass `--session-id` when available to preserve session-bound post-attempt-status hook correlation.

## Reports

```bash
pst reports write [--workspace <shorthand>] [--kind <kind>] [--name <name>] [--template <template>] [--source <source>]
pst reports save [--workspace <shorthand>] [--name <name>]
pst reports delete [--workspace <shorthand>] [--name <name>]
```

Reports are workspace-scoped review or validation documents under `.pstdio/reports/<name>/`. Use `reports write` to create a draft from a registered report template, place supporting evidence under `.pstdio/reports/<name>/files/`, then run `reports save` to persist the report and attachments.

## Templates

```bash
pst templates list                                # List all templates
pst templates create --name <n> --type <prompt|ticket|document> --file <path> [--default]
pst templates update --name <n> [--file <path>] [--default]
pst templates write --name <n> (--ticket <shorthand> | --target <path>) [--var KEY=value ...]
pst templates delete --name <n>
```

Bundled ticket templates: `ticket`, `bug-fix`, `proposal`.
Bundled doc templates: `prd`, `adr`, `architecture-overview`, `cookbook`, `code-review`, `lessons-learned`, `changelog-entry`, `contracts`, `schemas`, `research`.
Bundled prompt templates: `commit-message`, `squash-message`, `create-sub-tickets`, `implement-ticket`, `refine-ticket`, `fix-changes-requested`, `review-code`.

## Extensions

```bash
pst extensions add <source> [--name <name>] # Install an extension source using package scope
pst extensions check [--json]               # Validate user and repo-local extension roots
```

## Statuses and Tags

```bash
pst statuses list                                 # List ticket statuses
pst statuses create --name <n> --color <c> [--default]
pst statuses set-default --name <n>
pst statuses delete --name <n>

pst tags list                                     # List tags
pst tags create --name <n> --color <c>
pst tags delete --name <n>
```

Colors: gray, red, orange, amber, yellow, lime, green, teal, cyan, blue, indigo, violet, purple, pink, rose.

## Server and Dashboard

```bash
pst serve [--port <n>] [--host <host>]            # Start API server (default: 19840 on localhost)
pst close                                         # Stop background API
pst [--api-port <n>] [--dashboard-port <n>]       # Launch dashboard + open browser
```

Use `pst serve --host 0.0.0.0` to expose the API and dashboard to other devices on a trusted LAN. `pst serve` has no authentication; do not bind it to untrusted networks.

## Troubleshooting

- **"Project not found"**: Run `pst projects list` to verify the project exists, then `pst projects link --project-id <id>`.
- **Skills not installed**: Run `pst agents install-skills <agent-id>` to reinstall missing skills.
- **Extensions not available**: Run `pst extensions check` and reinstall the extension with `pst extensions add` if needed.
- **Config missing**: Check that `.pstdio/config.json` exists at the git root. Create with `pst projects create` or `pst projects link`.
- **API not reachable**: Run `pst serve` to start the API manually, or check if it is already running on the expected port. Check runtime logs in `~/.pstdio/logs.jsonl` (or your configured log path).
- **Error logs**: Startup failures and runtime errors are emitted through the shared logger stream (`stdout` and the configured JSONL target).
- **Agent not found**: Run `pst agents list` to check availability. Ensure the agent binary is installed and on your PATH.
- **Workspace issues**: Run `pst workspaces list` to see active workspaces. `pst workspaces delete --id <ws-id>` force-removes a stuck worktree.
