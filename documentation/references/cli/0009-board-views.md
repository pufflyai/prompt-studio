# Board views

Saved views belong to a project and a collection. The boards API includes extension views of kind `kanban` (a board or list) or `dataTable`, and the built-in Workspaces table. Workspaces uses the stable board ID `dashboard-workbench.workspaces` and has `extensionId: null`. Everyone sees the same saved views and collection default. Local storage keeps only the active selection, unsaved edits, and expanded or collapsed groups, scoped to the collection's context such as its project.

A view has three parts:

- `filter`: normal rules join with `and`. Optional `groups` hold one level of advanced rules, each with its own `and` or `or` conjunction. Normal rules and advanced groups combine using `and`. Existing whole-view `or` filters remain supported and appear as an Advanced filter bubble.
- `sorts`: zero or one `{ attributeId, direction }` pair. Display settings own this single ordering. An empty list means manual order on a board and query order on a table.
- `settings`: display settings for the board's kind.

```sh
pst views boards
pst views create --board dashboard-workbench.workspaces --title "Release workspaces" \
  --filter "name contains release" --sort created:desc --group type
pst views list --board <boardId>
pst views create --board <boardId> --title "Open urgent" \
  --filter "status is-none-of done" \
  --filter "priority is-any-of urgent,high" \
  --sort priority:asc
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
| `boolean` | `is`, `is-not` | `true` or `false`; the UI reads “Ticket is Archived” or “Ticket is not Archived” |
| `string` | `contains`, `does-not-contain`, `is`, `is-not` | Text. Compares ignore case |
| `number` | `is`, `is-not`, `gt`, `gte`, `lt`, `lte` | A number |
| `date` | `is`, `is-before`, `is-after`, `is-on-or-before`, `is-on-or-after` | A day: `2026-10-02`, `today`, `today-7`, or `today+7` |
| `enum`, `status`, `user` | `is-any-of`, `is-none-of` | Option values |
| `enum-multi` | `has-any-of`, `has-all-of`, `has-none-of` | Option values |

Every kind also accepts `is-empty` and `is-not-empty`, which take no value. Relative days such as `today-7` resolve against the viewer's date each time the view opens. A field of kind `enum-multi` cannot be sorted.

Dashboard date fields accept exact calendar days. The CLI and API also accept relative day values.

Use `--filter-json` for advanced groups or a whole-view `or`. It takes a full filter and cannot be combined with `--filter`. This example requires an unarchived ticket and either the selected assignee or a recent update:

```sh
pst views update --id <viewId> --filter-json '{
  "conjunction": "and",
  "rules": [
    { "attributeId": "archived", "condition": "is", "value": false }
  ],
  "groups": [
    {
      "conjunction": "or",
      "rules": [
        { "attributeId": "assignee", "condition": "is-any-of", "value": ["alex"] },
        { "attributeId": "updated", "condition": "is-after", "value": "today-7" }
      ]
    }
  ]
}'
```

`--sort <field>:asc|desc` sets the view's single sort. A second sort is rejected. `--filter none` and `--sort none` clear them. A board's card title is the built-in `string` field `title`.

Filter bubbles have a fixed property label; only their predicate and values can change. Positive option predicates read “is” for one value and “is any of” for multiple values; negative predicates read “is not”. Values have small right-side checkboxes, positive match counts, and their supplied icons and colors. The toolbar Filter button opens the property picker. Property rows show only the property label. Searching hides the value pane when its property no longer matches. Browsing a property does not add a rule. Choosing an option updates its bubble and keeps the picker open until the person closes it. Unchecking the last option removes that rule. Text, number, and date drafts use a full-width “Apply filter” button. Text properties then use borderless inline Editable text. Boolean, flags, and multiselect panels share the “Value” label and parameter-field inset. Text, number, and date editors share the Param Editor field scaffold and input recipes. Date editors stack the relative and exact day controls so both fit within the values pane. Clear all in the picker footer resets all criteria. Normal rules use AND. Advanced creation is in the picker footer; its flat editor supports AND or OR. Groups cannot contain other groups. Filtered boards, lists and tables keep their groups visible even with no matching items. When filters hide every existing board or list item and no columns, groups, or item rows remain visible, “Nothing matches this view” appears. Retained columns or rows suppress that message. Its Edit filter action opens the same toolbar picker.

The new-view button uses the layers-plus icon. Saved views offer Rename and Duplicate together, then Delete view in its own group. Default selection remains available through the API and CLI.

## Display settings

Board views take `--mode board|list`, `--columns <field>`, `--rows <field|none>`, and `--show <ids>` for the card properties. Data table views take `--group <column|none>`, `--row-numbers show|hide`, `--wrap-rows on|off`, `--stats on|off`, and `--show <ids>` for the visible columns in order. Columns not listed in `--show` are hidden. Each kind refuses the other kind's flags.

## Defaults and cleanup

Built-in views are read-only. Duplicate a built-in to change it. Any saved or built-in view can become the project default. Change the shared default only when requested. Deleting its saved view clears that default choice. Native Workspaces views belong directly to the project and are unaffected by extension disable or uninstall. Workspaces Diff displays additions and deletions, and supports sorting by their total. It cannot be filtered: unsupported and loading diff cells do not define a single scalar value.

The default order is the chosen project default, then the extension's `defaultActiveViewId`, then a built-in with the deprecated `isDefault` flag, then the first available view. Built-ins appear first; saved views follow their stored order.

When the API reads views, it removes what no longer fits the board: rules on missing or non-filterable fields, missing option values, rules left with no values, and sorts on missing fields. A rule whose field changes between a single option and several options keeps its meaning, for example `is-any-of` becomes `has-any-of`. Views saved before conditions existed picked exact values on every field, so an `is-any-of` list on a text, number, or date field keeps exact membership. Text stays case-sensitive and timestamps stay exact. These deprecated lists remain editable; new scalar rules use the conditions above. Any other rule whose condition no longer fits its field stays saved: the renderer skips it, and it works again if the field returns to its old kind. A failed query, or a data table that returns no rows to describe its columns, keeps saved views unchanged.

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

Use `createClient().views` in the SDK. Built-in mutations return 409 with duplication guidance. Invalid input returns 400 with the valid choices: an unknown field lists the fields that allow filtering or sorting, a condition the field does not accept lists that field's conditions, an unknown option lists the field's option values. Settings of the other board kind are refused. See [the ownership decision](../../adrs/0048-shared-project-board-views.md).
