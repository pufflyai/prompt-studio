# Extension API 0.2.0 migration

API 0.2.0 removes the APIs already deprecated in published package version 0.43.1. The API version stays 0.2.0 because these removals belong to the same unreleased breaking release. See [API versioning](0014-api-versioning.md).

Migrate extension callers on the published SDK and UI 0.43.1 first. Keep that extension PR separate from the platform removal PR. Update the host only after its installed extensions use the replacements.

| Removed API | Replacement |
| --- | --- |
| `ctx.sessions.list()`, `listByWorkspace()` | `ctx.sessions.query()`, or `query({ workspaceId })`; follow every `nextCursor`. Results are newest first. Set `includeArchived: true` when history includes archived sessions. |
| `ctx.workspaces.archive()`, provider `archive`, capability `archive`, `workspace.archived` event | Workspace delete operation, provider `delete`, capability `delete`, and `workspace.deleted`. Session archive operations remain available. |
| `defineStatuses`, `StatusContribution`, `WorkflowStatus`, `StatusActionDefinition`, `StatusRef`, `statuses` contributions, `status.v1` | [Extension-owned workflow records and settings](0016-workflow-status-migration.md), query enum options, and `boardColumnConfigs`. |
| Kanban attribute kind `status` | `enum` with query-owned options. Keep stored attribute and option IDs. |
| Kanban `ordering`, flat `filters`, `defaultFilters` | `sorts`, structured `filter`, and `defaultFilter`. |
| Kanban `onReorder` | `onMove`, which applies grouping changes and manual order together. |
| Saved view `isDefault`, including UI `CollectionSavedView.isDefault` | Collection `defaultActiveViewId` and the shared saved-view default. |
| SDK client `projects.listActivity()` | No project activity route remains. Read the supported domain APIs needed by the caller. |
| Chat `onOpenFile` props on `MessagePartsRenderer`, `ToolInvocationTimeline`, and `TimelineFromJSON` | `linkHandler.open`, with the shared file-link request. |

The generated workspace migration removes stored capability `archive` keys. If a row has no `delete` value, it copies the old `archive` value; an existing `delete` value takes precedence. Historical board migration code still reads older stored filters and ordering. New API requests use only structured filters and sorts.

Storage KV and collection APIs deprecated only on the current development branch remain available for their normal deprecation window.

Project settings contributions use `workbenchSlots.projectSettings` (`project.settings`). Commands from webviews receive the placement resource and a slot with the current project and panel. Command calls return the same response envelope in the dashboard, workbench, and testbench, including structured rejection details.
