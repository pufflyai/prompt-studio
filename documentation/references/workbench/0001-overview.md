# Overview

`@pstdio/workbench` is for people who build a host app on the workbench, not for extension authors. Extensions use `@pstdio/sdk/extensions` instead.

The package supplies the headless application model and the React shell that Prompt Studio itself runs on. Its registries and layout controllers are host APIs. Extension authors should read the [Extension API](../extensions/0001-api.md) reference, starting with [Workbench composition](../extensions/0008-contextual-workbench-composition.md) and [Modes and layout](../extensions/0009-modes-and-layout.md).

## Install

```sh
bun add @pstdio/workbench
```

The React integration needs the peer dependencies `react` and `react-dom` (19), `@chakra-ui/react` (3), and `@emotion/react` (11). The root, `storage`, and `webview-runtime` entries load without React. The [package guide](../../../packages/pstdio-workbench/README.md) covers setup.

## Pages

- [API](0002-api.md) covers package entry points, core services, panel registration, composition queries, resources, modes, persistence, and extension placement.
- [Contribution ownership](0003-contribution-ownership.md) explains module and extension attribution, lifecycle, and instance ownership.
- [Navigation](0004-navigation.md) explains explicit targets, canonical locations, breadcrumbs, and history.

Runnable examples live in the workbench's Storybook stories under `packages/pstdio-workbench/src/examples`. Start with the [panels and pages stories](../../../packages/pstdio-workbench/src/examples/api/api.stories.tsx).

## Tabs

Adding a tab creates it directly in the panel whose **+** was selected and keeps
other empty panels open. Closing or moving the last existing
tab out of Side or Bottom closes that panel.

Host Add commands receive the destination in `WorkbenchCommandExecutionContext.region`.
Pass it to the placement open call or panel navigation target. Placement open calls
use it for that open, including reuse of an existing tab. Omit it on ordinary opens
to retain the live layout's placement. Extension command navigation
results inherit the destination from the Add action.

Hover over a tab or focus it with the keyboard to see its full title in a tooltip.
The tooltip appears below the tab after 300 ms.

When a panel menu shows an opener in the header, the panel also shows its tab,
even for a single fixed panel. The tab keeps its existing close behavior.

Tabs can be dragged onto panel content, including webviews in panels without a
tab strip. During a tab drag, the workbench catches pointer events over panels
so iframe content cannot interrupt the drop, even at a disallowed destination.
Outside tab drags, webviews receive their normal pointer events and native file drops.

## Panel menus

Closing an attached panel menu hides it until its header opener is selected. The
opener attaches the menu directly when its panel is wider than 580 px and has room
for the menu, other attached menus, resize handles, and at least 120 px of content.
Menu minimum widths come from their contributions. Panels 580 px wide or narrower
keep their full width for content, so their menus float even when a menu would fit.
Menus that cannot be closed stay attached.

When attachment is not allowed, the opener shows a floating menu below the button.
The floating menu is as tall as its content. Taller content stops at the bottom
of the viewport, and the menu body scrolls under its title. It is a temporary view.
Opening or dismissing it does not change whether the menu is open.

An open menu attaches again as soon as its panel is wide enough. When space is
short, menus that cannot be closed attach first, then open menus from left to
right. Main, Secondary, and Side panel menus use the same rule.

## Menu selection and the floating launcher

Selection in shared menus uses a checkmark at the far right. Icons and labels stay
together on the left. Selection has no background fill; pointer hover and keyboard
focus keep their own feedback. Tree and navigation rows keep their selected backgrounds.
Use `SearchableMenu` or resource actions with `isSelected` for shared selection rows.
Native Chakra menu choices use `Menu.ItemText` and `Menu.ItemIndicator` with the shared recipe.

The floating Side Panel hides its launcher while open and restores it when closed.
The hidden launcher is inert and outside the accessibility tree. Panel content stays
mounted while closed, so minimizing and reopening preserves drafts. See the
[menu selection story](../../../packages/ui/src/components/overlays/menu-selection.stories.tsx)
and [Side Panel stories](../../../packages/pstdio-workbench/src/examples/side-panel/side-panel.stories.tsx).
