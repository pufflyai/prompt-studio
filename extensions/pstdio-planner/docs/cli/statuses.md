# Status CLI

Planner statuses define the columns and transitions used by the ticket board.

## Commands

```sh
pst statuses list
pst statuses create --label <label> [--color <color>] [--icon <icon>] [options]
pst statuses set-default --status <status>
pst statuses delete --status <status>
```

`create` also accepts `--can-create`, `--can-drag-in`, `--can-drag-out`, and `--column-actions <json>`.

```sh
pst statuses create --label "Triaging" --color amber
pst statuses set-default --status TODO
pst statuses delete --status "Triaging"
```

Statuses are stored per project. Planner seeds Backlog, TODO, In Progress, Blocked, In Review, and Done for a new project.

The color palette includes `gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `blue`, `indigo`, `violet`, `purple`, `pink`, and `rose`.
