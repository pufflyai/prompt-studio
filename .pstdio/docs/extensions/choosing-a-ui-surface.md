# Choosing a UI surface

This guide tells an extension author (human or agent) which UI contribution to use.
It is the canonical copy. The `create-pstdio-extension` skill carries a summary that
points here.

## The ladder

Start at the top. Move down only when the shape above cannot express the tool.

| The tool is... | Use | What the host gives you |
| --- | --- | --- |
| Items of a kind you own that users browse and open (tickets, files, runs) | `resource-kind` + a page that binds it | Collections, palette entries, history; the page's bindings are the presentation |
| A screen inside the project: static panels, resource tabs, or both | `page` | Breadcrumb, clean bench, derived tabs, per-slot open policy, resource arguments |
| A helper panel that should accompany a view everywhere it renders | `view-menu` | The side panel follows the owner view, including into every tab |
| A panel that persists across every page in a mode (terminal, sessions, logs) | `placement` into that mode | Survives page switches, because pages only take over the regions they declare |
| A tool that changes the bench itself: which regions exist, layout behavior | `mode` + static view placements | Region set, docked layout (rare; zen mode is the test) |
| Configuration, not a tool | `settings-panel` / `settings-section` | A place in settings |

There is no "single view as a screen" rung. A one-panel tool is a page with one
static slot. The smallest real example is the font editor: one view, one page with
one unclosable slot in `main`, one navigation item targeting the page
(`.pstdio/extensions/font-editor/extension.ts`).

## The one-line rules

- A view is content. It owns its title and icon and never claims a place.
- Tabs are not declared. A slot with content is a tab; cardinality and closability are slot policy.
- Open behavior belongs to the destination. Callers only choose `preview` or `pin`, and only `many` slots care.
- "Slot" means a page slot. Nothing else.
- If you are reaching for a mode, check whether you are changing the bench or just filling it. Filling it is a page.
- A page owns every region it declares, even while its slots there are closed. The region shows the page's placeholder, never mode furniture. Furniture that must survive page switches (terminal, sessions) is a mode placement in a region your pages leave undeclared.
- State lifetime is declared where the panel is declared: mode placement = mode-scoped, page slot = page-scoped by default, `scope: "location"` = per the page's active bound instance. Pick the rung; never track "current X" yourself in a view.
- Never invent an anchor resource to give a screen identity. Pages own identity, and a page's `path` is its URL, namespaced by the extension: `/projects/{project}/{extension-id}/{path}`.
- Activations (a row click, a tree node) always emit previews. Pinning is tab behavior (double-click a preview tab or its pin affordance) or an explicit `open: "pin"` on a page target. Renderers have no pin gesture.
- Link a native screen (workspaces, sessions, start) through its `workbenchPages.*` ref: the same page-target shape as everything else. Settings is not a page; open it by command.

## Worked example: the FDS shape

"A screen with a runs table, a file tree, and an editor" is one page:

```ts
const playground = definePage({
  id: "playground",
  title: l10n("pages.playground.title", "FDS Playground"),
  path: "fds-playground",
  slots: [
    { id: "runs", region: "main", view: runs.ref, closable: false },
    { id: "editor", region: "main", cardinality: "many" },
    { id: "tree", region: "sidenav", view: tree.ref },
  ],
  bindings: [{ resourceKind: fdsFileKind.ref, view: editor.ref, slot: "editor" }],
});
```

No mode, no anchor resource, no open strategies. Tree clicks emit files into the
`editor` slot as previews; pinning stacks them as tabs. See
`extensions/pstdio-planner/src/ui-contributions.ts` for the full board-plus-tabs
shape and [Extension modes and layout](./modes-and-layout.md) for the page model.

## Failure modes this ladder prevents

A real integration (Kito PR #1360) built this shape from low-level pieces and hit
five failures. Each one is now unrepresentable:

1. Hand-building `pstdio.<ext>.mode.<id>` strings. Page targets are typed refs, `switchMode` is a documented plain command (`workbenchCommands.switchMode` with `params.modeId`), and `pst extensions check` validates refs.
2. Placeholder resources invented to give a screen identity. Pages own identity; a page needs no resource to exist.
3. Files leaking into host navigation. A resource is never a destination. It lands in the active page's bound slot, or the caller names a page. There is no per-resource screen to leak to.
4. Tabs disappearing or duplicating after an upgrade. Inside a page, tab identity is `(page, slot, instance)`, not a derived widget id.
5. Stale persisted tab labels. Titles and icons are read from contributions at render time and never persisted.

## Related docs

- [Extension modes and layout](./modes-and-layout.md): the page and mode contract in detail.
- [Navigation](../references/workbench/navigation.md): page targets, emissions, and the URL scheme.
- [Navigation and layout state](./navigation-and-layout-state.md): what persists and how to reset it.
