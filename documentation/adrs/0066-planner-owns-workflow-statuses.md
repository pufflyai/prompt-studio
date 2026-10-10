# Planner owns workflow statuses; collection plumbing stays in core

Proposed: 2026-10-06

## Status

Accepted by the user on 2026-10-09 for PS-521. The platform deprecation is implemented in the first PR. Planner migration awaits the supporting published release.

## Context

The [mission](../../MISSION.md) puts shared workbench contracts in core and domain
workflows in extensions. The October audit grouped saved views, collection
renderers, and workflow statuses together. They have different owners.

Saved views serve the core Workspaces table and extension collections. Boards and
tables share grouping, filtering, sorting, and presentation contracts. Workflow
statuses have one shipped provider, Planner. Planner already stores its statuses
and enforces ticket rules; core supplies the status contribution contract and
shared editor.

## Decision

- Core owns collection rendering and saved views, including their shared API and
  storage. [ADR 0016](0016-collection-renderer-stays-in-core.md) and
  [ADR 0060](0060-shared-project-board-views.md) remain the basis for that plumbing.
- Planner owns ticket statuses, defaults, editing, deletion and reassignment,
  and workflow rules. Its editor uses a Planner settings panel and public commands.
- Core renders named choices through enum attributes supplied by the extension.
  The existing `KanbanRendererQueryResult.attributes` contract allows queries to
  return enum options. Start with that contract and `boardColumnConfigs` for
  column behavior. Do not add `attributeOptions` or `optionsFrom` unless a specific
  requirement cannot be met through the existing data flow.
- Deprecate the workflow-status contribution API and name its replacements.
  Preserve it until the shared breaking release under
  [API versioning](../references/extensions/0014-api-versioning.md).

This decision approves the ownership split. It does not claim the migration has
shipped or approve a new shared workflow engine.

## Implementation

1. Verify query-owned enum options in rendering, saved-view field resolution, and
   live refresh. Fix any gap in the responsible shared collection layer.
2. Mark status types, contributions, references, and the `status` attribute kind
   as deprecated. Keep old extensions working. Publish the supporting SDK/host
   release before extensions consume new exports or behavior.
3. Change Planner to return enum options from its existing status records and
   move status editing into its own panel. Use the same commands and rules for
   people and agents. Keep IDs and existing storage.
4. Remove deprecated status APIs together in the shared breaking release.

## Consequences

- Users retain board columns, colors, icons, ordering, defaults, drag rules,
  column actions, and saved filters. Status editing belongs to Planner settings.
- Existing tickets retain their status IDs. The ownership change alone needs no
  database schema change or new copy of status data.
- Saved views must keep working when the status field becomes an enum. Renames
  retain filter values; deletion follows the existing view cleanup rules.
- Live edits must refresh collection options and filter choices without a reload.
- External extensions using `defineStatuses`, `StatusRef`, or `status.v1` need a
  migration guide and a deprecation release before removal.
- Other tools can supply their own categories without adopting a ticket workflow.
- A future shared state-transition service requires its own mission review. It
  is not implied by keeping collection rendering in core.

## Alternatives

### Keep workflow statuses in core

Rejected. Planner can own the values and editor through public APIs. A dedicated
workflow contribution for one tool does not pass mission rule 1.

### Move collection rendering and saved views into Planner

Rejected. These are host workbench contracts used beyond Planner. Moving them
would split shared view behavior and repeat collection plumbing.

### Add a second query-options mechanism immediately

Rejected as the starting design. Query attributes already carry enum options.
Validate that path before introducing another contract for the same data.
