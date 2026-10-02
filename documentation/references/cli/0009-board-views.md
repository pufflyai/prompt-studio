# Shared board views

Saved views belong to a project and a board. A board is an extension view of kind `kanban` (a board or list) or `dataTable`. Everyone sees the same saved views and board default. Local storage keeps only the active selection, unsaved edits, and expanded or collapsed groups.

A view has three parts:

- `filter`: one root group of rules. A group joins its rules with one conjunction, `and` or `or`. The root group may hold rules and groups. A nested group may hold rules only.
- `sorts`: an ordered list of `{ attributeId, direction }`. The first sort decides first. An empty list means manual order on a board and query order on a table.
- `settings`: display settings for the board's kind.

```sh
pst views boards
pst views list --board <boardId>
pst views create --board <boardId> --title "Open urgent" \
  --filter "status is-none-of done" \
  --filter "priority is-any-of urgent,high" \
  --sort priority:asc --sort updated:desc
pst views update --id <viewId> --filter "title contains data table"
pst views update --id <viewId> --filter "updated is-after today-7"
pst views update --id <viewId> --filter none --sort none
pst views update --id <tableViewId> --group status --row-numbers hide
pst views create --board <boardId> --title "My copy" --copy-from <viewId>
pst views reorder --board <boardId> --ids <firstId>,<secondId>
pst views set-default --board <boardId> --id <viewId>
pst views set-default --board <boardId> --id none
pst views delete --id <viewId>
pst views list --orphaned
```

Commands print JSON. Use `--project-id` outside a linked folder. `pst views boards` lists each board's `kind` and its fields. Each field lists its `kind`, the `conditions` it accepts, whether it can be filtered, sorted, grouped, or displayed, and its `options`. Fields and options come from the board query, including dynamic tags and status providers. Data table fields come from the table's columns. Create and update resolve only their target board.

## Filters and sorts

`--filter "<field> <condition> [value]"` adds one rule. Repeat it to add more rules; they join with `and`. The value is the rest of the text, so `--filter "title contains data table"` matches "data table". Option values may be IDs or labels, separated by commas. An ambiguous label lists the matching values; use one of those values.

| Field kind | Conditions | Value |
| --- | --- | --- |
| `string` | `contains`, `does-not-contain`, `is`, `is-not` | Text. Compares ignore case |
| `number` | `is`, `is-not`, `gt`, `gte`, `lt`, `lte` | A number |
| `date` | `is`, `is-before`, `is-after`, `is-on-or-before`, `is-on-or-after` | A day: `2026-10-02`, `today`, `today-7`, or `today+7` |
| `enum`, `status`, `user` | `is-any-of`, `is-none-of` | Option values |
| `enum-multi` | `has-any-of`, `has-all-of`, `has-none-of` | Option values |

Every kind also accepts `is-empty` and `is-not-empty`, which take no value. Relative days such as `today-7` resolve against the viewer's date each time the view opens. A field of kind `enum-multi` cannot be sorted.

Use `--filter-json` for `or` and nested groups. It takes a full filter group and cannot be combined with `--filter`:

```sh
pst views update --id <viewId> --filter-json '{
  "conjunction": "and",
  "rules": [
    { "attributeId": "status", "condition": "is-none-of", "value": ["done"] },
    { "conjunction": "or", "rules": [
      { "attributeId": "assignee", "condition": "is-any-of", "value": ["alex"] },
      { "attributeId": "updated", "condition": "is-after", "value": "today-7" }
    ] }
  ]
}'
```

`--sort <field>:asc|desc` adds one sort. Repeat it; the flag order is the sort order. `--filter none` and `--sort none` clear them. A board's card title is the built-in `string` field `title`.

## Display settings

Board views take `--mode board|list`, `--columns <field>`, `--rows <field|none>`, and `--show <ids>` for the card properties. Data table views take `--group <column|none>`, `--row-numbers show|hide`, `--wrap-rows on|off`, `--stats on|off`, and `--show <ids>` for the visible columns in order. Columns not listed in `--show` are hidden. Each kind refuses the other kind's flags.

## Defaults and cleanup

Built-in extension views are read-only. Duplicate a built-in to change it. Any saved or built-in view can become the project default. Change the shared default only when requested. Deleting its saved view clears that default choice.

The default order is the chosen project default, then the extension's `defaultActiveViewId`, then a built-in with the deprecated `isDefault` flag, then the first available view. Built-ins appear first; saved views follow their stored order.

When the API reads views, it removes what no longer fits the board: rules on missing fields, missing option values, rules left with no values, empty groups, and sorts on missing fields. A rule whose field changes between a single option and several options keeps its meaning, for example `is-any-of` becomes `has-any-of`. A failed query keeps saved views unchanged.

Disabled boards are unavailable but keep their data. Uninstall keeps a disabled instance when it has user data, unless data deletion is requested. Removed board declarations leave orphaned views that can be listed and deleted.

## HTTP and SDK

All paths below start with `/v1/projects/{projectId}`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/boards` | Boards with their kind and resolved fields |
| GET | `/boards/{boardId}` | One board with its kind and resolved fields |
| GET | `/boards/{boardId}/views` | Built-in and saved views plus resolved default |
| GET | `/board-views/{viewId}` | One saved view |
| GET | `/board-views?orphaned=true` | Orphaned saved views |
| POST | `/boards/{boardId}/views` | Create: title, optional settings, filter, sorts, copyFrom |
| PATCH | `/board-views/{viewId}` | Update title, settings, filter, or sorts |
| DELETE | `/board-views/{viewId}` | Delete and clear its default atomically |
| PUT | `/boards/{boardId}/views/order` | Exact saved-view order: `{viewIds}` |
| PUT | `/boards/{boardId}/views/default` | Set or clear: `{viewId: string \| null}` |

Use `createClient().views` in the SDK. Built-in mutations return 409 with duplication guidance. Invalid input returns 400 with the valid choices: an unknown field lists the fields that allow filtering or sorting, a condition the field does not accept lists that field's conditions, an unknown option lists the field's option values, and a group nested too deep says that a nested group may hold rules only. Settings of the other board kind are refused. See [the ownership decision](../../adrs/0048-shared-project-board-views.md) and [the view model decision](../../adrs/0053-one-view-model-for-collection-renderers.md).
