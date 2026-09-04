# Dashboard UI contributions

Define each UI body once with `defineView`. A view can be a webview, tree, file, controls, data table, or Kanban body. Views do not own paths, modes, regions, or resource kinds.

Use these contributions to place or attach views:

- `pages` create routed screens with one primary slot and optional auxiliary slots.
- `placements` add mode-wide static views or resource bindings.
- `navigationItems` add explicit page, panel, command, href, or compound actions.
- `navigationTrees` add a tree view to the shared Sidenav for one mode or page.
- `viewMenus` attach a view to another view's menu.
- `settingsPanels` and `statusBarItems` attach a view to host chrome.

Page paths belong to `definePage`. A page resource binding chooses the primary view for a resource kind. An auxiliary page slot or mode placement produces a typed panel ref for explicit panel navigation.

```ts
const detail = definePage({
  id: "ticket",
  title: "Ticket",
  path: "ticket",
  mode: workbenchModes.project,
  parent: ticketsPage.ref,
  slots: [
    {
      id: "content",
      role: "primary",
      region: "main",
      binding: { kind: ticket.ref, view: editor.ref, cardinality: "one" },
    },
    {
      id: "properties",
      role: "auxiliary",
      region: "side",
      binding: { kind: ticket.ref, view: properties.ref, cardinality: "one" },
      openOn: "page-resource",
    },
  ],
});
```

Every binding declares `cardinality`: `one` keeps a single instance and rebinds it, `many` opens one instance per resource. A static auxiliary slot declares `presence` (`fixed`, `open`, or `closed`) instead. A bound auxiliary slot has no initial visibility; `openOn: "page-resource"` also opens it for the page's own resource when the kinds match. A page whose primary slot has only a binding must declare `parent`.

Webview capabilities belong to the reusable view body. Use `navigation.open` with an explicit target. The bridge does not infer a screen from a resource.
