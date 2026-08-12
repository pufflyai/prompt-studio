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
pst tickets implement --id <id>                        # Move to In Progress + launch agent
pst tickets files --id <id>                            # List ticket files
pst tickets workspaces --id <id> [--json]              # List workspaces linked to ticket
pst tickets worktrees list --id <id> [--json]          # List active worktrees for ticket
pst tickets worktrees remove-all --id <id>             # Remove all worktrees for ticket
pst tickets archive --id <id>                          # Archive ticket
pst tickets delete --id <id>                           # Delete ticket
```

`tickets view` accepts an optional positional field (`status`, `title`, `tags`, `shorthand`, `parent-ticket`, `sub-tickets`) to print only that value.

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
pst workspaces merge --id <ws-id> [--delete-workspace] # Squash-merge into current branch
pst workspaces delete --id <ws-id>                     # Force-remove workspace
```

Status rule:

- During creation/planning, `pst tickets update --status ...` is valid.
- During implementation, move the ticket to the configured in-progress status.
- When implementation is ready for review or blocked, update the ticket to the configured review or blocked status.
- Use `pst statuses list` to discover project-specific names and `pst tickets update --id <id> --status <status>` to apply them.

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
Bundled prompt templates: `commit-message`, `squash-message`, `create-sub-tickets`, `implement-ticket`, `refine-ticket`, `review-code`.

## Extensions

```bash
pst extensions add <source> [--name <name>] # Install an extension source using package scope
pst extensions check [--json]               # Validate user and repo-local extension roots
pst extensions dev <path> [--name <name>]   # Watch, validate, install, and refresh a local source
```

`pst extensions check` also compares declared dashboard UI surfaces with the dashboard capability descriptor. Text output prints `Host compatibility: verified` with the dashboard version. JSON output includes `hostCompatibility.status`, `hostCompatibility.host`, and diagnostics with `metadata.missingCapability` and `metadata.requiredSince`.

If no host descriptor is available, `hostCompatibility.status` is `unverified`. Contract validation still ran, but dashboard bridge support was not proven.

Run `pst extensions dev` inside a linked git project. It validates the extension and host capabilities before publishing an atomic installed snapshot. It reuses package-local dependencies for source-only edits, runs `bun install` after package or Bun lock changes, refreshes the enabled project instance, and prints contribution and webview IDs. Validation and build errors stay on stderr while the process keeps watching. Ctrl+C and SIGTERM stop cleanly and leave the last valid snapshot enabled.

To smoke-test an extension you are developing, install it into a throwaway Prompt Studio home so the
install cannot disturb your real one:

```bash
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions add <path-to-extension> --force
PSTDIO_HOME="$HOME/.pstdio-smoke" pst extensions check
```

Do not use `--skip-install` for user/global install validation. Installed extensions must have
package-local dependencies; otherwise the packaged runtime can end up following workspace
`node_modules` symlinks back into a repo checkout and fail to bundle.

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
- **Extension dev does not start**: Run it inside a linked git project and confirm the Prompt Studio host uses the same `PSTDIO_HOME` and API URL.
- **Extension dev dependency failure**: Fix `package.json`, `bun.lock`, `bun.lockb`, registry access, or the local dependency path. Save a dependency input to retry.
- **Extension dev webview failure**: Use the printed view ID and full Bun diagnostics. The watcher keeps the last successful webview active.
- **Config missing**: Check that `.pstdio/config.json` exists at the git root. Create with `pst projects create` or `pst projects link`.
- **API not reachable**: Run `pst serve` to start the API manually, or check if it is already running on the expected port. Check runtime logs in `~/.pstdio/logs.jsonl` (or your configured log path).
- **Error logs**: Startup failures and runtime errors are emitted through the shared logger stream (`stdout` and the configured JSONL target).
- **Agent not found**: Run `pst agents list` to check availability. Ensure the agent binary is installed and on your PATH.
- **Workspace issues**: Run `pst workspaces list` to see active workspaces. `pst workspaces delete --id <ws-id>` force-removes a stuck worktree.
