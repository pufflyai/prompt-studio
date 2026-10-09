# Saved collection views

Custom extension screens can reuse the saved views of a native board or table. These views are project data. The dashboard, CLI, and extension commands use the same storage and validation.

The next SDK release adds `ctx.views` on API `0.1.2`. That API version already covers additive changes since the last tagged release, so this change keeps it. Pass a `ViewRef` for the native board or table. Local refs resolve inside the calling extension. Public refs can name another extension's collection.

```ts
const board = { kind: "view", id: "tickets" } as const;
const saved = await ctx.views.list(board);
const created = await ctx.views.create(board, {
  title: "Ready work",
  filter: {
    conjunction: "and",
    rules: [{ attributeId: "status", condition: "is-any-of", value: ["ready"] }],
  },
});
await ctx.views.update(board, created.id, { title: "Team work" });
await ctx.views.setDefault(board, created.id);
await ctx.views.reorder(board, [created.id, ...saved.views.map((view) => view.id)]);
await ctx.views.remove(board, created.id);
```

The project API validates filters and settings against the collection's fields. Update and removal check that the saved view belongs to the requested board. A board must retain one view. No database migration or extension-owned copy of the views is needed.

Webviews call extension commands through `createWebviewClient`. Subscribe to `viewDataEvents.boardViewsChanged` and reload the views when a view or its default changes. The host coalesces these notifications per project.

## Shared header

`@pstdio/ui/collection-view` exports the same header used by data tables and Kanban:

- `CollectionViewBar` renders saved view tabs, search, filters, and a supplied display control.
- `useCollectionViews` selects the saved views and follows changes from another client.
- `useCollectionViewStore` owns the active view and its unsaved edits.
- `filterRowsByView` evaluates the shared filter rules. `withTitleField` includes the title field.
- `searchRows` searches the visible text supplied by the renderer.
- `ViewBarPopover` provides the shared popover shell for custom display controls.

Provide a `CollectionViewsSource` backed by `ctx.views` commands. Keep search and selection local. Keep the collection's saved settings, filters, and sorts in the project API. A custom presentation can share a native collection's filters while retaining its own display preferences.

See [the collection header stories](../../../packages/ui/src/components/collection-view/collection-view-bar.stories.tsx) for props and interactions, and [ADR 0060](../../adrs/0060-shared-project-board-views.md) for storage ownership.
