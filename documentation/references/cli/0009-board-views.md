# Shared board views

Saved views belong to a project and board. Everyone sees the same saved views and board default. Local storage keeps only active selection, unsaved settings, filters, and expanded groups. Old locally saved views are dropped when this version starts.

```sh
pst views boards
pst views list --board <boardId>
pst views create --board <boardId> --title "Urgent bugs" \
  --filter priority=Urgent --filter type=Bug --mode list \
  --sort created:desc --show id,priority,workspace
pst views update --id <viewId> --title "Urgent work"
pst views create --board <boardId> --title "My copy" --copy-from <viewId>
pst views reorder --board <boardId> --ids <firstId>,<secondId>
pst views set-default --board <boardId> --id <viewId>
pst views set-default --board <boardId> --id none
pst views delete --id <viewId>
pst views list --orphaned
```

Commands print JSON. Use `--project-id` outside a linked folder. `--columns <field>` and `--rows <field|none>` change grouping. Filters accept option values or labels. An ambiguous label lists matching values; use one of those values. Fields and options come from the board query, including dynamic tags and status providers. Create and update resolve only their target board.

Built-in extension views are read-only. Duplicate a built-in to change it. Any saved or built-in view can become the project default. Change the shared default only when requested. Deleting its saved view clears that default choice.

The default order is the chosen project default, then the extension's `defaultActiveViewId`, then the first available view. Built-ins appear first; saved views follow their stored order. Missing options and fields are cleaned when the API reads views. A failed query preserves saved values.

Disabled boards are unavailable but retain data. Uninstall keeps a disabled instance when it has user data, unless data deletion is requested. Removed board declarations leave orphaned views that can be listed and deleted.

## HTTP and SDK

All paths below start with `/v1/projects/{projectId}`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/boards` | Boards and resolved fields |
| GET | `/boards/{boardId}` | One board and resolved fields |
| GET | `/boards/{boardId}/views` | Built-in and saved views plus resolved default |
| GET | `/board-views/{viewId}` | One saved view |
| GET | `/board-views?orphaned=true` | Orphaned saved views |
| POST | `/boards/{boardId}/views` | Create: title, optional settings, filters, copyFrom |
| PATCH | `/board-views/{viewId}` | Update title, settings, or filters |
| DELETE | `/board-views/{viewId}` | Delete and clear its default atomically |
| PUT | `/boards/{boardId}/views/order` | Exact saved-view order: `{viewIds}` |
| PUT | `/boards/{boardId}/views/default` | Set or clear: `{viewId: string \| null}` |

Use `createClient().views` in the SDK. Built-in mutations return 409 with duplication guidance. Invalid fields or option values return 400 and list valid IDs. See [the ownership decision](../../adrs/0047-shared-project-board-views.md).
