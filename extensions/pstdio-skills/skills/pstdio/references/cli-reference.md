# Prompt Studio CLI reference

Run `pst --help`, `pst <group> --help`, or `pst <group> <command> --help` for the options available in the installed version.

## Runtime

```sh
pst [--api-port <port>] [--open-browser <boolean>]
pst serve [--port <port>] [--host <host>]
pst close [--force]
pst logs [--lines <count>] [--path]
```

`pst` starts the runtime and serves the dashboard on the API's own origin. Detached runtimes require a loopback host.

## Projects

```sh
pst projects create [name]
pst projects list
pst projects view [--project-id <id>]
pst projects delete <project-id>
```

The host accepts ordinary folders and uses `--path <folder>`. Older hosts with extension API `1.0.0-alpha.12` require a Git repository and accept `--repo <folder>`. Run `pst projects create --help` to check your installed host.

## Agents

```sh
pst agents list
pst agents setup <agent-id> [--global-skills]
pst agents install-skills <agent-id> [--global-skills] [--force]
```

`setup` and `install-skills` install only skills whose folder is missing. They keep existing folders unchanged, including edited ones, and list them as kept. `install-skills --force` replaces the folder of each enabled skill with the source and discards local edits; it never touches skills that are not enabled. `setup` has no `--force`. Neither command sets a default agent. See [Agents](https://prompt.studio/docs/references/cli/agents/).

## Sessions

```sh
pst sessions create --prompt <text> [--title <title>] [--workspace-id <id>] [--project-id <id>] [--agent <agent>] [--model <model>] [--attach <path>...] [--original-session-id <id>]
pst sessions list [--project-id <id>] [--status <status>] [--agent <agent>] [--workspace-id <id>] [--archived]
pst sessions view --id <id>
pst sessions follow-up --id <id> [--prompt <text> | --summary-of <id>] [--summary-format <brief|detailed>] [--summary-role <assistant|all>] [--agent <agent>] [--model <model>] [--attach <path>...]
pst sessions stream --id <id>
pst sessions approve --id <id> --approval-id <id>
pst sessions deny --id <id> --approval-id <id>
pst sessions stop --id <id>
pst sessions archive --id <id>
pst sessions resolve-session-id --agent <agent> --agent-session-id <id> [--cwd <path>] [--json]
```

## Workspaces

```sh
pst workspaces create --provider <id> [--params <json>]
pst workspaces create --provider pstdio.worktree --params '{"base":"main"}'
pst workspaces list [--json]
pst workspaces merge --id <id> [--delete-workspace]
pst workspaces delete --id <id>
```

Run these inside a linked project. `--id` takes a workspace short name such as `default`, `WS-1`, or `PS-12_A1`. Core workspace creation is standalone and gets a `WS-<n>` name. Link it to one or more tickets with `pst tickets link --id <ticket> --workspace <workspace>`. Planner also creates linked workspaces through managed attempts.

`delete` removes the workspace. For a Git worktree it also removes the branch and any uncommitted changes. There is no archive that keeps a workspace readable. See [Workspaces](https://prompt.studio/docs/references/cli/workspaces/).

## Extensions

```sh
pst extensions add <source> [--name <name>] [--force] [--skip-install] [--branch <branch>]
pst extensions check [source] [--scope <repo|user>] [--json]
pst extensions dev <source> [--name <name>]
pst extensions test <source> [--json]
pst extensions update [name] [--project-id <id>]
```

Run these inside a linked project. `add` installs an extension by catalog name or local folder. A local folder is `.`, `..`, an absolute path, or a path starting with `./`, `../`, or `~/`; any other value is a catalog name. Release 0.43.1 and older read a bare `.` as a catalog name, so pass an absolute path to work on every release. `check <source>` checks a local folder against the API version of the `pst` you ran; `check` without a source asks the host to check what it installed, with the host's API version. `--json` output always reports the `pst` versions; read the host's app version in **Help** in the dashboard. Use `--branch` only when developing against a branch. `dev` watches a local source, validates it, installs dependencies when needed, and refreshes the enabled project instance. `update` asks the host to upgrade eligible project instances to the release paired with that host. It leaves local sources and enablement state alone.

## Notifications

```sh
pst inbox [--project-id <id>] [--status <status>] [--priority <priority>] [--limit <count>]
pst notifications list [--project-id <id>] [--status <status>] [--priority <priority>] [--limit <count>]
pst notifications show <id> [--project-id <id>]
pst notifications send --project-id <id> --kind <kind> --title <title> [--body <body>] [--priority <priority>] [--target <type:id>] [--dedupe-key <key>]
pst notifications read <id> [--project-id <id>]
pst notifications done <id> [--project-id <id>]
pst notifications dismiss <id> [--project-id <id>]
pst notifications snooze <id> --until <time> [--project-id <id>]
```

## Planner tickets

These aliases are available when the `pstdio-planner` extension is enabled.

```sh
pst tickets list [--status <status>] [--tags <tag>...] [--parent <id>] [--archived] [--draft]
pst tickets create [--title <title>] [--content <markdown>] [--status <status>] [--tags <tag>...] [--parent <id>] [--depends-on <id>...]
pst tickets add [same options as create]
pst tickets panel --id <id>
pst tickets update --id <id> [--content <markdown>] [--status <status>] [--tags <tag>...] [--parent <id>] [--unlink-parent] [--depends-on <id>...] [--clear-depends-on] [--blocked-reason <text>]
pst tickets link-review --id <id> --url <url> [--title <title>]
pst tickets archive --id <id>
pst tickets unarchive --id <id>
pst tickets delete --id <id>
pst tickets write --title <title> [--status <status>] [--tags <tag>...] [--user-prompt <text>] [--parent <id>]
pst tickets save --id <id> [--status <status>]
pst tickets pull [--id <id>] [--force]
pst tickets files --id <id>
pst tickets implement --id <id> [--agent '{"harnessId":"<harness>"}']
pst tickets link --id <id> (--workspace <workspace> | --session <session-id>)
pst tickets unlink --id <id> (--workspace <workspace> | --session <session-id>)
pst tickets workspaces --id <id>
pst tickets worktrees list --id <id>
pst tickets worktrees remove-all --id <id>
pst tickets proposal-refined --id <id>
```

`tickets save` reads the body, tags, parent, dependencies, and files from the local ticket tree. In the ticket file's front matter, `depends_on` lists prerequisite tickets. On `update`, `--depends-on` replaces every dependency; omit it to keep them.

Record waiting for another ticket with `depends_on`, not with a Blocked status or `--blocked-reason`. Planner works out readiness from the prerequisites. Use `--blocked-reason` only for a blocker that is not another ticket, such as missing credentials.

Archiving or deleting a ticket also deletes its linked workspaces, with their uncommitted changes, once no active ticket uses them. The Planner project setting **Delete linked workspaces** controls this and is on by default. See [Planner CLI](https://prompt.studio/docs/extensions/planner/cli/).

## Planner statuses and tags

```sh
pst statuses list
pst statuses create --label <label> [--color <color>] [--icon <icon>] [--can-create] [--column-actions <json>]
pst statuses update --status-id <status-id> [options]
pst statuses reorder --status-ids <json>
pst statuses set-default --status <status>
pst statuses delete --status <status>

pst tags list
pst tags create --name <name> [--type <single_select|multi_select>]
pst tags delete --tag <tag>
```

## Reports

These aliases are available when the `pstdio-reports` extension is enabled.

```sh
pst reports write [--workspace <id>] [--kind <kind>] [--name <name>] --template <template> [--source <source>]
pst reports read --id <report-id>
pst reports save [--workspace <id>] [--name <name>]
pst reports delete [--workspace <id>] [--name <name>]
```

`reports write` returns absolute host paths in the default project folder for the report and its evidence files. Edit those paths, then use `reports save`. These paths do not refer to a remote workspace filesystem.

Workspace params must match the provider declaration. Unknown keys, invalid values, and missing required values fail before creation. Omitted params use declared defaults. For Git worktrees, `base` defaults to the current branch; pass `base: main` explicitly to start from `main`. Errors list the accepted params and options.

## Troubleshooting

| Problem | Command or check |
| --- | --- |
| Project is not linked | Run `pst projects create` from the selected folder. |
| Skills are missing | Run `pst agents install-skills <agent-id>`. |
| Installed skills are out of date | Move any local edits into the source skill, then run `pst agents install-skills <agent-id> --force`. |
| Extensions fail validation | Run `pst extensions check`, then inspect the diagnostics. |
| Runtime is unreachable | Run `pst serve`, then `pst logs`. |
| Workspace cleanup failed | Run `pst workspaces list`, then remove the exact workspace when its work is safe. |

### `pst: command not found`

The `pst` command is not on this shell's `PATH`. Do not search for another copy. See also [the `pst` command is missing or out of date](https://prompt.studio/docs/guides/getting-started/troubleshooting/#the-pst-command-is-missing-or-out-of-date). Run the CLI that ships with the desktop app by its full path, with the same arguments:

| Installation | Use in place of `pst` |
| --- | --- |
| macOS | `"/Applications/Prompt Studio.app/Contents/Resources/bin/pstdio"` |
| Linux DEB | `/usr/lib/prompt-studio/resources/bin/pstdio` |
| Linux portable ZIP | `<extracted folder>/resources/bin/pstdio` |
| Windows (PowerShell) | `& "$env:LOCALAPPDATA\PromptStudio\bin\pst.cmd"` |

For example, on macOS:

```sh
"/Applications/Prompt Studio.app/Contents/Resources/bin/pstdio" --version
```

Keep the quotes on macOS, because the path contains a space. If the file does not exist, ask the person where Prompt Studio is installed.

Then tell the person how to add `pst` to their terminal:

- macOS: in the desktop app, choose **Prompt Studio → Install pst Command…**.
- Windows: open a new terminal. The installer adds `pst` to `PATH`, and open terminals do not see the change.
- Linux: install the DEB package, which adds `/usr/bin/pst`.

## Shared board views

Use `pst views boards` to discover board and data table IDs, each field's kind,
the conditions it accepts, whether it sorts, and its current options. Use
`pst views list --board <boardId>` to inspect built-in and saved views. Create a
shared view with `pst views create --board <boardId> --title "Open urgent"
--filter "status is-none-of done" --filter "priority is-any-of urgent,high"
--sort priority:asc --sort updated:desc`. A filter is `<field> <condition> [value]`;
repeated filters join with "and", and the flag order of `--sort` is the sort
priority. Option values can be IDs or labels, comma-separated; use IDs when a
label is ambiguous. Dates take a day or `today-7`. For "or" groups, pass a full
filter with `--filter-json`. Clear rules with `--filter none` or `--sort none`.
Data table views also take `--group`, `--row-numbers show|hide`, `--wrap-rows on|off`,
`--stats on|off`, and `--show <column ids>`. If a field refuses a condition, the
error lists the conditions it accepts. Commands print JSON. Use `--project-id`
outside a linked project folder.

Use `pst views update --id <viewId> --title "New name"` to edit a saved view and
`pst views delete --id <viewId>` to remove it. Duplicate a view with
`pst views create --board <boardId> --title "Copy" --copy-from <viewId>`.
Built-in views are read-only. Use `pst views set-default --board <boardId>
--id <viewId>` only when asked to change the shared project default; pass `none`
to clear it. Reorder saved views with `pst views reorder --board <boardId>
--ids <firstId>,<secondId>`. List removed boards' saved views with
`pst views list --orphaned` and delete them by ID.

Saved views and defaults are project data. Active selection and unsaved edits
stay local to each client. Old locally saved views are dropped. See the
[board view reference](https://prompt.studio/docs/references/cli/board-views/).
