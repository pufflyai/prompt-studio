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

Build the static Storybook with `bun run --cwd packages/ui build-storybook`. Use the owning package's scripts for dashboard or workbench stories; their ports and setup differ.

For changes visible in the application, also use [manual Playwright validation](0002-development-setup.md#playwright-validation). Check actual sizing, focus, navigation, themes, and resource switching. Passing a component story does not replace the affected installed-product walkthrough.

See [design rules](../../design/DESIGN.md), [UI package guidance](../../packages/ui/README.md), and [testing](0003-testing.md).
