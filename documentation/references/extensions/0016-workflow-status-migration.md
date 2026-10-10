# Workflow status migration

Extensions own workflow values and editing. Use query-owned enum attributes to display those values in shared collections. The deprecation release advances the extension API to 0.1.3 after the published 0.1.2 release.

## Deprecated APIs

`defineStatuses`, `StatusContribution`, `WorkflowStatus`, `StatusActionDefinition`,
`ExtensionDefinition.statuses`, `StatusRef`, the `status` attribute kind, and the
`status.v1` host capability are deprecated. They still load and run during the
deprecation window. A status contribution produces a warning that names the
replacement. Removal happens together in a later breaking release, never in this
deprecation release. See [API versioning](0014-api-versioning.md).

| Old API | Replacement |
| --- | --- |
| `defineStatuses`, `StatusContribution`, `ExtensionDefinition.statuses` | Extension-owned records and commands, plus a settings panel |
| `WorkflowStatus` | Domain records owned by the extension; `KanbanRendererEnumOption` for display |
| `StatusActionDefinition` | `KanbanRendererColumnAction` in `boardColumnConfigs`, plus extension-owned editor choices |
| `StatusRef` and attribute kind `status` | Enum options returned in `KanbanRendererQueryResult.attributes` |
| `status.v1` | `view.kanban.v1`, `command.v1`, and `settings.panel.v1` |

## Return choices from the collection query

Keep your existing records and stable IDs. Read them in the collection query and
return their labels, colors, icons, and order as enum options:

```ts
const attributes = [{
  id: "state",
  label: "State",
  type: {
    kind: "enum" as const,
    options: statuses.map((status) => ({
      value: status.id,
      label: status.label,
      color: status.color,
      icon: status.icon,
    })),
  },
  filterable: true,
  groupable: true,
  sortable: true,
}];
return { rows, attributes, boardColumnConfigs };
```

Return options in the intended column order. Use `boardColumnConfigs`, keyed by
the same IDs, for column colors, create actions, drag rules, and column actions.
Keep the existing attribute ID and row values so saved views continue to group
and filter on the same values. Renames change labels, not IDs. Deleted options
follow normal saved-view cleanup; filters on remaining IDs are retained.

Do not add another options store. The query result carries the current choices.
After a mutation, emit the extension's existing change event so the host refreshes
the collection query. See [renderer refresh](0012-renderer-edit-refresh-lifecycle.md).

## Own the editor and commands

Provide a settings panel using `defineSettingsPanel`. Its view calls public
commands defined with `defineCommand`. Use those same commands from the CLI.
Defaults, ordering, deletion fallback, ticket reassignment, and bulk-save rules
belong in the extension operations called by those commands. A default remains
extension data; it is not an enum option property.

During migration, keep the legacy provider until the replacement is validated.
Then stop declaring it. Do not delete or copy its stored records merely to change
the rendering contract.

## Delivery order

Publish the SDK and host deprecation release before migrating an extension. Keep
platform and extension changes in separate PRs. Remove all deprecated workflow
status APIs together in the shared breaking release, with the other scheduled
removals. Collection rendering, saved-view storage and APIs, and `pst views`
remain shared core plumbing.

The ownership decision is recorded in
[ADR 0066](../../adrs/0066-planner-owns-workflow-statuses.md).
