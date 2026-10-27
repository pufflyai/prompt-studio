# Storybook coverage

Storybook defines component APIs and props. Pencil defines their visual design. Use stories to demonstrate UI states and `play` functions to check meaningful interactions.

## What the runner proves

The Storybook test runner checks stories without `play` for rendering errors. A `play` function adds interaction assertions. Rendering successfully does not prove that editing, navigation, validation, or persistence works. See the [runner contract](https://storybook.js.org/docs/writing-tests/integrations/test-runner).

Avoid a permanent list of supposedly uncovered stories: it becomes stale as components move. Inspect the stories beside the component being changed and identify the behavior each one exercises.

## Choosing a story

1. Start with the normal useful state.
2. Add loading, empty, disabled, error, or long-content states when the component supports them.
3. For an interactive component, exercise its user-visible outcome: open a menu, change a value, submit a form, switch a resource, or close a panel.
4. Assert the result through roles and visible state. Do not add assertions only to repeat literal copy or prove that deleted UI remains absent.
5. Keep shared design-system behavior in shared component stories. Product flows belong in dashboard browser journeys.

## Local checks

Start the UI Storybook and run the package's runner against it:

```sh
bun run storybook:ui
```

In another terminal:

```sh
bun run --cwd packages/ui test-storybook
```

Browser interactions shared across story owners live in `packages/storybook-tests`. Run one with `bun run --cwd packages/storybook-tests test:browser -- src/ui/pstdio-workbench/panel-tabs.p1.spec.ts`. This suite owns Storybook startup and playback waits independently from app E2E. Story source stays beside the component.

Build the static Storybook with `bun run --cwd packages/ui build-storybook`. Use the owning package's scripts for dashboard or workbench stories; their ports and setup differ.

For changes visible in the application, also use [manual Playwright validation](0001-setup.md#playwright-validation). Check actual sizing, focus, navigation, themes, and resource switching. Passing a component story does not replace the affected installed-product walkthrough.

See [design rules](../../../design/DESIGN.md), [UI package guidance](../../../packages/ui/README.md), and [testing](0002-testing.md).

For side-by-side extra theme comparisons, use the [theme package Storybook](0007-extra-theme-comparison.md).

## UI Canvas migration

The repository's [UI Canvas extension](../../../.pstdio/extensions/canvas/README.md) also indexes current story exports and MDX documents. Its native catalog renders source components in the Canvas webview and exposes props and source references. The original Storybook stories and play functions remain the interaction-validation source during migration.

The Canvas migration ledger retains design identities and asset provenance from RP-1. Pencil entries labeled **Design reference** have not transferred design authority. A native initial render does not by itself prove every interaction-derived state or visual override. The `canvas:coverage` acceptance command rejects stale builds and incomplete design mappings. See the extension README for rebuild, Docker verification, and remaining checks.
