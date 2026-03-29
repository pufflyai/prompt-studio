# pstdio CLI Reference

## Contents

- Projects
- Agents
- Tickets
- Sessions
- Workspaces
- Templates
- Statuses and tags
- Documentation
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

### Startup Scripts

```bash
pstdio projects startup-script set [--file <path>]  # Set startup script (reads stdin if no --file)
pstdio projects startup-script get                  # Print startup script
pstdio projects startup-script clear                # Clear startup script
```

## Agents

```bash
pstdio agents list                                  # List agents with status
pstdio agents setup <agent-id> [--global-skills]    # Configure + install skills
pstdio agents update <agent-id> [--default] [--binary <path>] [--skills-dir <path>]
pstdio agents remove <agent-id> [--delete-skills]   # Remove agent config
pstdio agents install-skills <agent-id> [--global-skills]  # Reinstall missing skills
```

## Tickets

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
pstdio workspaces list                               # List active workspaces
pstdio workspaces merge --id <ws-id> [--delete-workspace]  # Squash-merge into current branch
pstdio workspaces set-status [--workspace <shorthand>] --status <s>  # Update attempt status (auto-detects workspace from branch)
pstdio workspaces delete --id <ws-id>                # Force-remove workspace
pstdio workspaces startup-log --id <ws-id>           # Show startup script log
```

Status rule:

- During creation/planning, `pstdio tickets update --status ...` is valid.
- During and after implementation, prefer `pstdio workspaces set-status` and avoid direct ticket status updates.

## Templates

```bash
pstdio templates list                                # List all templates
pstdio templates create --name <n> --type <prompt|ticket|document> --file <path> [--default]
pstdio templates update --name <n> [--file <path>] [--default]
pstdio templates write --name <n> --target <shorthand|docs/path>
pstdio templates delete --name <n>
```

Bundled ticket templates: `ticket`, `proposal`.
Bundled doc templates: `prd`, `adr`, `cookbook`, `review-me`, `lessons-learned`.

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

## Documentation

```bash
pstdio docs init       # Initialize .pstdio/docs/ structure
```

## Server and Dashboard

```bash
pstdio serve [--port <n>]                            # Start API server (default: 19840)
pstdio close                                         # Stop background API
pstdio [--api-port <n>] [--dashboard-port <n>]       # Launch dashboard + open browser
```

## Troubleshooting

- **"Project not found"**: Run `pstdio projects list` to verify the project exists, then `pstdio projects link --project-id <id>`.
- **Skills not installed**: Run `pstdio agents install-skills <agent-id>` to reinstall missing skills.
- **Config missing**: Check that `.pstdio/config.json` exists at the git root. Create with `pstdio projects create` or `pstdio projects link`.
- **API not reachable**: Run `pstdio serve` to start the API manually, or check if it is already running on the expected port. Check `~/.pstdio/error-logs/` for startup and runtime error details.
- **Error logs**: Startup failures and runtime errors are persisted to `~/.pstdio/error-logs/` as JSON files. Check the most recent file for details when the server fails silently.
- **Agent not found**: Run `pstdio agents list` to check availability. Ensure the agent binary is installed and on your PATH.
- **Workspace issues**: Run `pstdio workspaces list` to see active workspaces. Use `--force` with `workspaces delete` if a worktree is stuck.
