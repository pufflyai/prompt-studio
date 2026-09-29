# Board views are core project data

Proposed: 2026-09-28

## Status

Accepted for PS-415.

## Context

Saved kanban board views live in client storage (browser local storage or the desktop state file), keyed by panel instance. People can create them, agents cannot, and they do not sync. The kanban renderer is a core UI contract used by several extensions.

## Decision

Saved views are project data owned by the core API. They are stored in the `board_views` table per project and board, shared by everyone in the project, synced through the existing event bus, and managed through one REST API that both the dashboard and `pst views` use. Extension `defaultViews` stay extension-owned and are shown as read-only built-ins. They are never copied into the table. Any available view, saved or built-in, can be the board's default, so the default is stored per board in `board_default_views` rather than as a flag on a view. Both tables are extension user data and follow the extension's disable and uninstall rules.

## Options considered

1. **Keep views in the client, add a bridge for agents.** Rejected. Agents would write into one client's storage, other clients would not see it, and the "Where we are headed" goals of team pickup and remote work stay blocked.
2. **Each extension stores its own views through `ctx.storage` and exposes commands.** Rejected. Every extension with a board would rebuild the same plumbing, and the view bar is host UI that an extension cannot take over. Mission rule 1 puts shared plumbing in the core.
3. **Core-owned project data (chosen).** One owner, one API for people and agents, live sync for free.

## Consequences

- Views follow the project to every client and machine.
- Agents and people use the same interface and rules (mission rule 4).
- Views saved locally before this change are dropped, not migrated.
- Saved views remove filters on values that no longer exist. The API cleans them on read, so the core never needs to know about an extension's deletes.
- Personal views are out of scope. Adding them later means an owner column and visibility rules, not a new design.
- Tree view customization has the same problem and should follow this decision.
