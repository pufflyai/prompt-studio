---
status: "proposed"
created: "2026-03-18T12:00:00Z"
---

# PRD: Dashboard browser page titles

## Status

This is an unimplemented browser-title requirement. The current dashboard HTML uses the static title `Prompt Studio`. Workbench tabs and breadcrumbs have their own labels; they do not establish dynamic browser tab titles.

## Problem and goal

Several open dashboard browser tabs are hard to distinguish. A future title controller should project the active workbench location into a concise human-readable title.

## Requirements

1. Derive the title from the canonical workbench page location and its resolved resource labels. Do not maintain a second route or selection store.
2. For a project-level page, include the project and page labels, for example `Example > Sessions`.
3. For a resource page, show its resolved display name, for example the selected session title or workspace shorthand.
4. Use extension page/resource labels through public contracts; do not hardcode Planner ticket or Notes routes into core.
5. Recompute when location or resolved labels change. Stale asynchronous reads must not overwrite the active page's title.
6. Fall back to the page label or `Prompt Studio` while context is unavailable. Never show `undefined` or an internal contribution ID.
7. Keep the browser title independent of workbench tab naming and breadcrumb rendering.

## Out of scope

Search-engine optimization, configurable title templates, and new routes for retired docs or onboarding screens.

## Acceptance evidence

A future implementation needs a Storybook or browser journey that navigates between project, session, workspace, and extension pages, changes a resource title, and verifies fallback behavior during loading. Follow the [design rules](../../../design/DESIGN.md) and [manual browser workflow](../../guides/development/0001-setup.md#playwright-validation).

Current sources: [dashboard HTML](../../../packages/pstdio-dashboard/index.html) and [page navigation](../../references/workbench/0004-navigation.md).
