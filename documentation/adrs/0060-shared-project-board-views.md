# Board views are core project data

Proposed: 2026-09-28

## Status

Accepted for PS-415.

## Context

Saved board views live in client storage (browser local storage or the desktop state file), keyed by panel instance. People can create them, agents cannot, and they do not sync. Saved views belong to the host view bar of the collection renderers: kanban boards and data tables. The core Workspaces data table and every extension data table use them. The kanban renderer itself has one shipped user, the planner. The other kanban boards are an Extension Lab example and a repo-local extension.

## Decision

Saved views are project data owned by the core API. They are stored in the `board_views` table per project and board, shared by everyone in the project, synced through the existing event bus, and managed through one REST API that both the dashboard and `pst views` use. Extension `defaultViews` define starting views. When a board has no saved views, the API saves these starting views as ordinary project views. Users can edit, rename, reorder, and delete them. A board must retain at least one view; storage enforces this inside the deletion transaction. Existing saved views remain the board's views, and deleted starting views do not reappear. Any saved view can be the board's default, stored per board in `board_default_views` rather than as a flag on a view. Both tables are extension user data and follow the extension's disable and uninstall rules.

## Options considered

1. **Keep views in the client, add a bridge for agents.** Rejected. Agents would write into one client's storage, other clients would not see it, and the "Where we are headed" goals of team pickup and remote work stay blocked.
2. **Each extension stores its own views through `ctx.storage` and exposes commands.** Rejected. Every extension with a board would rebuild the same plumbing, and the view bar is host UI that an extension cannot take over. Mission rule 1 puts shared plumbing in the core.
3. **Core-owned project data (chosen).** One owner, one API for people and agents, live sync for free.

## Consequences

- Native collections use the same storage and API. Workspaces uses `dashboard-workbench.workspaces` with no extension owner. Its views belong directly to the project. Extension-owned rows keep their disable and uninstall rules; rows with a null `extension_instance_id` are native project data. Default scope uniqueness treats null owners as equal, so a native collection has one shared default per project.
- Views follow the project to every client and machine.
- Agents and people use the same interface and rules (mission rule 4).
- Views saved locally before this change are dropped, not migrated.
- Saved views remove filters on values that no longer exist. The API cleans them on read, so the core never needs to know about an extension's deletes.
- Personal views are out of scope. Adding them later means an owner column and visibility rules, not a new design.
- Tree view customization has the same problem and should follow this decision.

## Corrections

- 2026-10-08 (PS-548): starting views now become user-owned saved views. Read-only built-ins prevented people from changing their own board. The only view management constraint is keeping at least one view.

- 2026-10-06 (PS-505): renumbered from 0048 to 0060, because [Motion Lab runtime studies](0048-motion-lab-runtime-studies.md) also used 0048. The context claimed the kanban renderer was "used by several extensions". Only the planner ships a kanban board. The decision still holds because saved views also serve data tables, including the core Workspaces table. Whether the kanban and status contracts stay in core is proposed in PS-521.
