# ADR 0016: keep the grouped collection renderer in core

## Status

Proposed.

## Context

Prompt Studio's mission says a project tracker belongs in an extension. Core should provide only the
shared plumbing that extensions cannot reasonably rebuild or that most extensions need.

The kanban renderer is shared plumbing. It renders rows, attributes, groups, filters, saved views,
and inline edits from data supplied by a caller. It contains no ticket fields. The planner uses it
for tickets, while the dashboard uses it for workspaces. The data table also reuses its collection
types and state.

The old contracts did contain tracker-specific rules:

- The only attribute display kind was `workspace-badge`. A core renderer contract named a platform
  entity and could not render the same shape for another extension's data.
- `WorkflowStatus.board` stored create, drag, and column action rules on a shared workflow value.
- A status-backed board was forbidden from returning `boardColumnConfigs`, even though that query
  result is the public place for board rules.
- The shared status editor invented three action ids to carry board rules through the status type.

This broke mission rule 2. The planner had already implemented `statusToColumnConfig`, but the host
rejected its output and forced the extension through a core-only special case.

## Decision

The grouped collection renderer stays in the core workbench. Its tracker-specific vocabulary and
special cases are removed.

Attribute displays use a closed union of data-shaped kinds. The first kind is `badge-list`, which
reads `CollectionBadgeItem[]`. Each item has an id, label, optional icon, and optional resource.
Display kinds may name data shapes. They may not name platform entities.

Board rules come only from `KanbanRendererQueryResult.boardColumnConfigs`. Status-backed boards may
return these configs. A supplied config wins. If a board supplies no config for a status column, the
renderer uses that status's color and no other status data.

`WorkflowStatus` no longer contains board rules. The shared status editor edits status fields only.
The planner owns the editor for its stored create and drag rules.

The renderer keeps the name `kanban`, the `view.kanban.v1` capability id, and its browser storage
key. Renaming is a separate decision because it would change public SDK type names, installed
manifests, and saved user settings.

Unknown runtime display kinds do not remove the renderer. The workbench reports the extension
problem, removes the unresolved display instruction, and renders the attribute with its normal type
formatter.

## Alternatives

### Move the renderer into the planner

Rejected. The workspace board would either depend on a ticket tracker or copy the renderer. The data
table would still need the shared collection types. Moving the code would preserve the domain leaks
instead of fixing them.

### Keep board rules on statuses

Rejected. A workflow value does not own the permissions of one view. The query result already has a
complete board-column config, so a second source only creates state that must stay in sync.

### Add arbitrary extension-provided React displays

Deferred. Loading an extension component inside a host-rendered cell needs a larger security and
runtime contract. No current consumer needs it. The closed union is the one place where a future
registry can attach.

### Rename the renderer now

Rejected for this change. The repository contains more than 200 files that use the name. The public
SDK types, capability id, manifest body kind, and browser storage key would all change. The contract
fix is independent of that migration.

## Consequences

Any extension can declare a grouped board over its own collection and supply its own column rules,
including when it groups by a status set. Badge lists can represent contributors, workspaces, or
other linked records without changing core.

The planner returns the board rules it already stores. Its status provider preserves those rules
when the shared editor changes labels, colors, icons, order, or the default status. Planner settings
continue to expose the create and drag toggles.

This is an alpha contract break. Repository consumers move together. There is no compatibility shim
for `workspace-badge` or `WorkflowStatus.board`.

The name `kanban` remains inaccurate for list mode and shared collection state. A later rename must
handle installed capability declarations and migrate the existing browser storage key.

## Removal

Nothing in this decision is temporary. The removed parts are `workspace-badge`,
`WorkflowStatus.board`, `WorkflowStatusBoardRules`, `statusColumnConfig`, the status-backed query
error, and the three `workbench.status.can-*` action ids.
