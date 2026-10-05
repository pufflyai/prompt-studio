# Workbench composition

Extension UI is built from views, pages, and modes. This page explains what each one owns and how they share the workbench's panel regions.

## Views, pages, and modes

A view supplies content. A page owns its route, routed resource, Main presentation, and extra panels. A mode owns shared panels, chrome, and region policy. A resource identifies data; it does not choose a route or panel.

Define each view body once with `defineView`. Native tree, file, controls, table, and Kanban views follow the same placement rules as webviews.

Pages declare `resource: { kinds }` separately from `main`. A Main view renders routed content; a Main collection renders peer panels and an empty view. Page `slots` and mode placements use the same item contract: a static view, or a resource binding. A binding declares `kinds`, `view`, `cardinality`, and an optional `add` action. Presence, mounting, and tab presentation mean the same thing for both.

## Regions and targets

Main, Side, and Secondary are the three panel regions. Page and mode owners can contribute to the same region.

Use page targets to change location and panel targets for auxiliary content. A panel target opens one instance without changing the page location. Generated refs such as `page.panels.inspector` keep the page as the panel's owner. A compound page-and-panel target enters an owner before opening its dependent panel, and commits only when all steps resolve.

## Mode chrome and navigation

Navigation items and trees contribute to the default host sidebar, including in custom modes. When a mode omits a chrome key, the host keeps its own navigation there, including custom-mode navigation items. A declared view replaces that chrome; `false` hides it. Mode placements keep their identity across pages in the same mode and are removed when their owner is removed.

## Examples

The [workbench cookbook](../../guides/extensions/0002-workbench-cookbook.md) links working examples for editable pages, inspectors, shared panels, editor collections, provider refs, and webview lifecycle. See also [Contributions](0004-contribution-api.md), [Modes and layout](0009-modes-and-layout.md), [Navigation and layout state](0010-navigation-and-layout-state.md), and the [composition architecture](../architecture/0009-extension-workbench-composition.md).
