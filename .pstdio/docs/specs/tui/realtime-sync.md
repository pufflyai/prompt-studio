# TUI Spec: Real-Time Sync

When any client (CLI, TUI, dashboard) changes data, every connected TUI instance updates automatically. No polling, no manual refresh.

---

## Rules

1. **The sync stream is the source of truth.** The TUI never fetches data via REST. All reads come from the sync stream.
2. **Mutations go through REST.** Create, update, and delete actions call the API. Changes flow back to all clients through the sync stream — including the client that made the change.
3. **No manual refetch after mutation.** The sync stream delivers changes automatically.
4. **Derived fields are computed client-side.** When data spans multiple tables (e.g. a ticket's status name), the TUI joins the data locally.
5. **Filter by project client-side.** The sync stream contains all data across all projects. The TUI filters to the active project.

---

## Tickets

- Terminal A creates a ticket → Terminal B sees it appear in the list.
- Terminal A changes a ticket's status → Terminal B sees it move to the new status group.
- Terminal A archives a ticket → Terminal B sees it disappear from the active list.
- Tags assigned in one terminal appear on the ticket in all terminals.

## Templates

- Terminal A sets a new default template → Terminal B sees the `*` marker move.
- CLI creates a template → all TUI instances see it appear.
- CLI deletes a template → all TUI instances see it disappear.
- Template content edits propagate to all terminals viewing that template.

## Projects

- CLI creates a project → all TUI instances see it in the project picker.
- CLI deletes a project → all TUI instances see it disappear from the picker.
- CLI renames a project → the header updates in all TUI instances viewing that project.
- CLI links a repo → TUI instances see the updated repo list.

Project _selection_ is intentionally local. Two terminals can view different projects independently. Only the project _data_ syncs.

## Agents

- Terminal A configures an agent → Terminal B sees it in the agent manager.
- Terminal A removes an agent → Terminal B sees it disappear.
- Terminal A sets a default agent → Terminal B sees the default marker update.

## Statuses

- CLI creates a status → all TUI instances see it appear in the settings overlay and status pickers.
- CLI changes a status color → all TUI instances see the updated color.
- CLI sets a new default status → all TUI instances see the `*` marker move.
- CLI deletes a status → all TUI instances see it disappear from lists and pickers.
- Status group headers in the tickets tab update when statuses are added, renamed, or deleted.

## Tags

- CLI creates a tag → all TUI instances see it in the settings overlay and tag pickers.
- CLI changes a tag color → all TUI instances see the updated color.
- CLI deletes a tag → all TUI instances see it disappear from lists and pickers.
- Tag badges on tickets update when a tag's color changes.

## Docs

Not synced. Docs are loaded from local filesystem. This is intentional — docs are part of the repo, not the database.

---

## Connection Status

The status bar shows sync state:

| State        | Display         |
| ------------ | --------------- |
| Connected    | `sync: ok`      |
| Disconnected | `sync: offline` |

On disconnect, the TUI reconnects automatically and catches up on missed events.
