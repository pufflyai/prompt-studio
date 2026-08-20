# Ticket CLI

Planner owns the `pst tickets` command group. Ticket IDs can be full storage IDs or shorthands such as `PS-12`.

## Commands

```sh
pst tickets list [--status <status>] [--tags <tag>...] [--parent <id>] [--archived] [--draft]
pst tickets create [--title <title>] [--content <markdown>] [--status <status>] [--tags <tag>...] [--parent <id>]
pst tickets add [same options as create]
pst tickets panel --id <id>
pst tickets update --id <id> [options]
pst tickets link-review --id <id> --url <url> [--title <title>]
pst tickets archive --id <id>
pst tickets delete --id <id>
pst tickets write --title <title> [--status <status>] [--tags <tag>...] [--user-prompt <text>] [--parent <id>]
pst tickets save --id <id> [--status <status>]
pst tickets pull [--id <id>] [--force]
pst tickets files --id <id>
pst tickets implement --id <id> [--agent <agent>]
pst tickets workspaces --id <id>
pst tickets worktrees list --id <id>
pst tickets worktrees remove-all --id <id>
pst tickets proposal-refined --id <id>
```

`create` and `add` are aliases. Use either one to create a stored ticket directly.

`panel` returns the complete stored ticket record.

`update` can change `--content`, `--status`, repeatable `--tags`, `--parent`, and `--blocked-reason`. Use `--unlink-parent` to remove a parent link.

## Local ticket workflow

`write` creates a draft ticket and writes `.pstdio/tickets/<shorthand>/ticket.md`. Edit that file and any files under its `files/` directory, then run `save`.

```sh
pst tickets write --title "Fix login" --status TODO --tags High
pst tickets save --id PS-12
```

`save` reads the body, tags, parent, dependencies, and files from the local ticket. Its only direct update option is `--status`.

`pull` writes stored tickets to the local `.pstdio/tickets` tree. Without `--id`, it pulls all active tickets. Existing local files are preserved unless `--force` is set.

## Workspaces and reviews

`implement` starts a managed implementation attempt. Use `workspaces` or `worktrees list` to inspect the work linked to a ticket. `worktrees remove-all` removes every linked worktree.

`link-review` attaches a review URL, such as a pull request, to the ticket. `proposal-refined` marks a proposal as ready for a person to review.

See the [Planner CLI index](./index.md) for namespaced attempt and review commands.
