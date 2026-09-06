# Workbench composition

A view supplies content. A page owns its route, routed resource, Main presentation, and extra panels. A mode owns shared panels, chrome, and region policy. A resource identifies data; it does not choose a route or panel.

Pages declare `resource: { kinds }` separately from `main`. A Main view renders routed content; a Main collection renders peer panels and an empty view. Page `slots` and mode placements use the same static-view or resource-binding item contract. Presence, mounting, and tab presentation have the same meaning for both.

Main, Side, and Secondary are the three panel regions. Page and mode owners can contribute to the same region. A panel target opens one instance without changing the page location. A compound page-and-panel target enters an owner before opening its dependent panel and commits only when all steps resolve.

Omitted mode chrome retains host navigation, including custom-mode navigation items. A declared view replaces the chrome; `false` hides it. Mode placements keep their identity across pages in the same mode and dispose when their owner is removed.

Read the [cookbook](cookbook.md), [navigation and layout state](navigation-and-layout-state.md), and [composition architecture](../architecture/extension-workbench-composition.md).
