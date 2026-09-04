# pstdio-workbench

`pstdio-workbench` is the composition layer for Prompt Studio. It provides the headless workbench model and the React shell that renders it.

## Architecture

The workbench has one location owner: `pageLocations`. A page transition changes the URL, browser history, active page, mode, primary resource, layout, and breadcrumbs as one operation.

- A **page** owns one primary slot and may own auxiliary slots.
- A **mode** contributes shared chrome and panels used by all pages in that mode.
- A **panel target** opens content inside the current page or mode. It does not change the page.
- A **command target** runs an action. It does not imply navigation.
- A **resource** is data passed to a page or panel. A resource does not decide where it appears.

The public navigation targets are `page`, `panel`, `command`, `href`, and `compound`. There is no generic resource target, view target, presenter, or direct mode switch.

## Public entry points

- `@pstdio/workbench` exports the headless core, contribution types, registries, and controllers.
- `@pstdio/workbench/react` exports the React shell and renderer hosts.
- `@pstdio/workbench/storage` exports browser persistence for page location, layout, trees, and panel state.
- `@pstdio/workbench/extensions` maps checked extension metadata into workbench contributions.
- `@pstdio/workbench/webview-runtime` exports the runtime used inside extension webviews.

## Pages and modes

Pages are the only durable navigation unit. Register a page with its mode, path, slots, and optional parent. Open it through `pageLocations.navigate()` or a `page` navigation target.

Modes are shared page context. Their contributions become active before the page slots are composed. Do not activate modes from navigation UI. Moving to another mode means opening a page that declares that mode.

The `PageComposition` Storybook story demonstrates a Session page changing to a Lab page. The assertion verifies that the Session primary slot is removed rather than left beside the Lab page.

## Panels

A page auxiliary slot or mode placement exposes a panel reference. Use a `panel` target to open it. The target is valid only while its owner is active:

- A page-slot panel belongs to the active page.
- A mode-placement panel belongs to the active mode.

This ownership rule prevents panels from leaking between pages or modes.

## Resources

Resources identify product data. Resource kinds provide labels and icons. Providers make resources searchable. Every searchable result that can be opened supplies an explicit activation callback.

Resources never choose a surface or presenter. The page or panel target supplies placement, while the resource supplies data.

## Renderers

A renderer supplies UI for a registered panel. Specialized registries cover trees, data tables, Kanban boards, files, controls, and settings.

Tree nodes may carry resource metadata for selection and context actions. Navigation requires an explicit target. A bare resource on a node is not a navigation instruction.

## Settings

Settings remains a command-owned overlay. Open it with `WORKBENCH_SETTINGS_OPEN_COMMAND_ID` and optional `{ panelId, itemId }` arguments. It does not use the page location or a generic resource presenter.

## Persistence

Page location owns browser history and durable restoration. Layout persistence stores the current page composition. There is no second workbench history stack and no last-resource restoration path.

## Documentation

Workbench Storybook separates learning material from API facts:

- `Guides/Core onboarding` builds a host workbench from an empty shell.
- `Guides/Extension onboarding` builds extensions with `@pstdio/sdk/extensions`.
- Other guides explain one feature at a time and state whether it belongs to Core or the Extension API.
- `Reference/Core API` documents host-only registries, controllers, renderers, and React surfaces.
- `Reference/Extension API` documents the public extension contract.

Each guide includes the source used by its live example. Start Storybook and copy a guide's source into the stated package context to reproduce it.
