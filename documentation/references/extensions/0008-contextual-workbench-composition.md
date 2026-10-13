# Workbench composition

Extension UI is built from views, pages, and modes. This page explains what each one owns and how they share the workbench's panel regions.

## Views, pages, and modes

A view supplies content. A page owns its route, routed resource, Main presentation, and extra panels. A mode owns shared panels, chrome, and region policy. A resource identifies data; it does not choose a route or panel.

Define each view body once with `defineView`. Native tree, file, controls, table, and Kanban views follow the same placement rules as webviews.

Pages declare `resource: { kinds }` separately from `main`. A Main view renders routed content; a Main collection renders peer panels and an empty view. Page `slots` and mode placements use the same item contract: a static view, or a resource binding. A binding declares `kinds`, `view`, `cardinality`, and an optional `add` action. Presence, mounting, and tab presentation mean the same thing for both.

## Regions and targets

Main, Side, and Secondary remain shared panel regions. Every page also has `"aside"` and `"bottom"`: separate tab panels inside Main that belong to the page. Existing page Side and Secondary slots retain their behavior.

Use page targets to change location and panel targets for auxiliary content. A panel target opens one instance without changing the page location. Generated refs such as `page.panels.inspector` keep the page as the panel's owner. A compound page-and-panel target enters an owner before opening its dependent panel, and commits only when all steps resolve.

## Page panels and menus

Declare headerless page menus with `panelMenus.left` or `panelMenus.right`. Each declaration contains a view reference, optional `size` (`defaultPx`, `minPx`, `maxPx`), `collapsible`, and `hiddenByDefault`. Menus follow the routed page resource independently of the selected tab.

```ts
definePage({
  id: "workspace",
  title: "Workspace",
  path: "workspace",
  mode: workbenchModes.project,
  resource: { kinds: [workspaceKind.ref] },
  main: { kind: "panels", empty: files.ref },
  panelMenus: {
    right: { view: inspector.ref, size: { defaultPx: 240 }, collapsible: true },
  },
  regionSettings: { bottom: { size: { defaultPx: 160 }, alwaysShowTabs: true } },
  slots: [{
    id: "terminal",
    region: "bottom",
    item: { kind: "view", view: terminal.ref, presence: "open" },
  }],
});
```

Menus render beside the editor tab row and span the full editor height, below the breadcrumb. They have no header, tabs, add action, or tab-drop target. The page bottom has its own tab header and remains separate from the mode's Secondary panel. Main's Page panels menu controls collapsible menus and both page panels and opens bottom tools.

`viewMenus`, `ViewMenuContribution`, and `defineViewMenu` are deprecated in favor of page `panelMenus`. Existing view-owned menus keep their behavior during the deprecation period.

## Mode chrome and navigation

Navigation items and trees contribute to the default host sidebar, including in custom modes. When a mode omits a chrome key, the host keeps its own navigation there, including custom-mode navigation items. A declared view replaces that chrome; `false` hides it. Mode placements keep their identity across pages in the same mode and are removed when their owner is removed.

## Examples

The [workbench cookbook](../../guides/extensions/0002-workbench-cookbook.md) links working examples for editable pages, inspectors, shared panels, editor collections, provider refs, and webview lifecycle. See also [Contributions](0004-contribution-api.md), [Modes and layout](0009-modes-and-layout.md), [Navigation and layout state](0010-navigation-and-layout-state.md), and the [composition architecture](../architecture/0009-extension-workbench-composition.md).

## Page side and bottom panels

Every page has a page side (`aside`) and a page bottom (`bottom`), initially closed when empty. Slots are optional. Use `slots[].region: "aside"` to seed the page side and `regionSettings.aside` to set its panel policy. Aside and bottom share size, header visibility, `canOpen`, `canClose`, `acceptsTabs`, `resizable`, `movable`, and `defaultTab` settings. A default tab opens only on a direct open of an empty panel. Floating is supported only by the mode Side.

Tabs moved into either page panel stay with the page instance. Panel sizes and edges are saved per page type. The page side runs the full height below the breadcrumb beside the editor and page bottom. The page bottom spans the editor column. Page menus sit beside the editor tab row at full editor height and accept no tabs. Legacy slots in `"side"` still refer to the mode Side; `"aside"` adds the page side without changing that meaning.

Host workbench pages can author `regionSettings.aside.edge` as `"left"` or `"right"` and `regionSettings.bottom.edge` as `"top"` or `"bottom"`. These host geometry fields are separate from the public extension policy fields. Defaults are right and bottom. Whole-panel move commands and gestures follow in PS-613.
