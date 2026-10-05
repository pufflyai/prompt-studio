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
