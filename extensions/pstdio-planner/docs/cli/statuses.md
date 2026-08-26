# Status CLI

Planner statuses define the columns and transitions used by the ticket board.

## Commands

```sh
pst statuses list
pst statuses create --label <label> [--color <color>] [--icon <icon>] [options]
pst statuses update --status-id <id> [options]
pst statuses reorder --status-ids <json>
pst statuses set-default --status <status>
pst statuses delete --status <status>
```

`create` and `update` accept `--can-create`, `--can-drag-in`, `--can-drag-out`, and
`--column-actions <json>`. `update` also accepts `--label`, `--color`, `--icon`, and `--sort-order`.
Use `--no-can-create`, `--no-can-drag-in`, or `--no-can-drag-out` to turn off a behavior.

```sh
pst statuses create --label "Triaging" --color amber
pst statuses update --status-id backlog --label Backlog --color gray --icon status-backlog
pst statuses reorder --status-ids '["backlog","ready","in-progress","blocked","in-review","done"]'
pst statuses set-default --status TODO
pst statuses delete --status "Triaging"
```

Statuses are stored per project. Planner seeds Backlog, TODO, In Progress, Blocked, In Review, and Done for a new project.

The color palette includes `gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `blue`, `indigo`, `violet`, `purple`, `pink`, and `rose`.
