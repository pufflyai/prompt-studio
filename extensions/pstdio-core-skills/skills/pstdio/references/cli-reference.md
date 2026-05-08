# pstdio CLI Reference

## Contents

- Projects
- Agents
- Plugins
- Tickets
- Sessions
- Workspaces
- Templates
- Statuses and tags
- Server and dashboard
- Troubleshooting

## Projects

```bash
pstdio projects create [name]              # Create project, scaffold .pstdio/
pstdio projects link --project-id <id>     # Link repo to existing project
pstdio projects unlink                     # Unlink repo from project
pstdio projects list                       # List all projects
pstdio projects view [--project-id <id>]   # View project details
pstdio projects repos [--project-id <id>]  # List linked repos
pstdio projects delete <project-id>        # Delete a project
```

## Agents

```bash
pstdio agents list                                  # List agents with status
pstdio agents setup <agent-id> [--global-skills] [--global-plugins]
pstdio agents update <agent-id> [--default] [--binary <path>] [--skills-dir <path>]
pstdio agents remove <agent-id> [--delete-skills]   # Remove agent config
pstdio agents install-skills <agent-id> [--global-skills]   # Reinstall missing skills
pstdio agents install-plugins <agent-id> [--global-plugins] # Reinstall missing plugins
```

## Plugins

```bash
pstdio plugins list [--project-id <id>]      # List registered plugins
pstdio plugins register [--project-id <id>]  # Force plugin registration
```

Plugins are auto-discovered from `.pstdio/plugins/` at runtime — `register` is only needed when a long-running process has cached an earlier state. See the **create-pstdio-plugin** skill for authoring guidance.

## Tickets

```bash
pstdio tickets write --title "<title>" [--user-prompt "<desc>"] [--template <name>] [--status <s>] [--tag <t>] [--parent-id <id>]
pstdio tickets create --content "<title>" [--status <s>] [--tag <t>] [--parent-id <id>]
pstdio tickets list [--status <s>] [--tag <t>] [--parent-id <id>] [--archived] [--draft]
pstdio tickets pull [--id <id>] [--force]                 # Pull one or all non-archived tickets
pstdio tickets update --id <id> [--status <s>] [--tag <t>] [--parent-id <id>] [--no-parent-id]
pstdio tickets save --id <id> [--status <s>] [--tag <t>]
pstdio tickets view [field] --id <id> [--project-id <id>] # View ticket (or a single field)
pstdio tickets implement --id <id>                        # Set wip + launch agent
pstdio tickets files --id <id>                            # List ticket files
pstdio tickets workspaces --id <id> [--json]              # List workspaces linked to ticket
pstdio tickets worktrees list --id <id> [--json]          # List active worktrees for ticket
pstdio tickets worktrees remove-all --id <id>             # Remove all worktrees for ticket
pstdio tickets update-when-attempt-status --id <id> --all-attempts-status <s> --set-status <s>
pstdio tickets archive --id <id>                          # Archive ticket
pstdio tickets delete --id <id>                           # Delete ticket
```

`tickets view` accepts an optional positional field (`status`, `title`, `tags`, `shorthand`, `parent-ticket`, `sub-tickets`) to print only that value.

`tickets update-when-attempt-status` is the safe way to transition a ticket once every attempt has reached a given attempt status — use it from hooks or agents instead of direct `tickets update --status`.

## Sessions

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

## Workspaces

```bash
pstdio workspaces create --id <shorthand> [--base <ref>]  # Create worktree for ticket
pstdio workspaces list                                    # List active workspaces
pstdio workspaces list-statuses [--project-id <id>] [--json]  # List available attempt statuses
pstdio workspaces merge --id <ws-id> [--delete-workspace] # Squash-merge into current branch
pstdio workspaces set-status [--workspace <shorthand>] --status <s> [--session-id <id>]
pstdio workspaces delete --id <ws-id>                     # Force-remove workspace
```

Default attempt statuses: `wip`, `blocked`, `review-ready`, `reviewed`, `changes-requested`.

Status rule:

- During creation/planning, `pstdio tickets update --status ...` is valid.
- During and after implementation, prefer `pstdio workspaces set-status` and avoid direct ticket status updates.
- For agent-driven transitions, pass `--session-id` when available to preserve session-bound post-attempt-status hook correlation.

## Templates

```bash
pstdio templates list                                # List all templates
pstdio templates create --name <n> --type <prompt|ticket|document> --file <path> [--default]
pstdio templates update --name <n> [--file <path>] [--default]
pstdio templates write --name <n> (--ticket <shorthand> | --target <path>) [--var KEY=value ...]
pstdio templates delete --name <n>
```

Bundled ticket templates: `ticket`, `proposal`.
Bundled doc templates: `prd`, `adr`, `architecture-overview`, `cookbook`, `code-review`, `lessons-learned`, `changelog-entry`, `contracts`, `schemas`, `research`.
Bundled prompt templates: `commit-message`, `squash-message`, `create-sub-tickets`, `implement-ticket`, `refine-ticket`, `fix-changes-requested`, `review-code`.

## Statuses and Tags

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

## Server and Dashboard

```bash
pstdio serve [--port <n>] [--host <host>]            # Start API server (default: 19840 on localhost)
pstdio close                                         # Stop background API
pstdio [--api-port <n>] [--dashboard-port <n>]       # Launch dashboard + open browser
```

Use `pstdio serve --host 0.0.0.0` to expose the API and dashboard to other devices on a trusted LAN. `pstdio serve` has no authentication; do not bind it to untrusted networks.

## Troubleshooting

- **"Project not found"**: Run `pstdio projects list` to verify the project exists, then `pstdio projects link --project-id <id>`.
- **Skills not installed**: Run `pstdio agents install-skills <agent-id>` to reinstall missing skills.
- **Plugins not loaded**: Run `pstdio plugins list` to verify discovery; `pstdio agents install-plugins <agent-id>` reinstalls bundled plugins, `pstdio plugins register` re-registers them.
- **Config missing**: Check that `.pstdio/config.json` exists at the git root. Create with `pstdio projects create` or `pstdio projects link`.
- **API not reachable**: Run `pstdio serve` to start the API manually, or check if it is already running on the expected port. Check runtime logs in `~/.pstdio/logs.jsonl` (or your configured log path).
- **Error logs**: Startup failures and runtime errors are emitted through the shared logger stream (`stdout` and the configured JSONL target).
- **Agent not found**: Run `pstdio agents list` to check availability. Ensure the agent binary is installed and on your PATH.
- **Workspace issues**: Run `pstdio workspaces list` to see active workspaces. `pstdio workspaces delete --id <ws-id>` force-removes a stuck worktree.
