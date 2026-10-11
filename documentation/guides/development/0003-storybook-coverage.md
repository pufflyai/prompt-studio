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

For changes visible in the application, also use [manual Playwright validation](0001-setup.md#playwright-validation). Check actual sizing, focus, navigation, themes, and resource switching. Passing a component story does not replace the affected installed-product walkthrough.

## Workbench windowing fixture

The [windowing fixture](../../../packages/pstdio-workbench/src/examples/windowing/fixture.ts) supplies two workspaces with Files, Changes, and terminal-like views; Note A and Note B; and sessions bound to each workspace. It also reuses the Boombox and Kiln host examples. Create a new fixture inside each story's component. Do not keep a workbench, resource data, or probe at module scope.

The in-memory adapters clone layout and page-location data. Reload disposes the old workbench and creates a new one from those saved values. View drafts and mount counters expose remounts. The sandboxed iframe has its own draft and mount identity. The terminal-like view attaches to a separate fixture resource runtime with start/stop counters. These counters prove fixture adapter behavior only; they do not prove backend session or PTY continuity.

`packages/e2e/src/ui/workbench-windowing.spec.ts` runs the windowing stories in the existing UI e2e job. Add each later windowing story ID to its list. The spec waits for playback, rejects render and play error events, and checks the `storyFinished` success result. A finished render alone can include a render or play failure. It also edits the sandboxed iframe through Playwright's frame locator.

```sh
bun run --cwd packages/pstdio-workbench lint
bun run --cwd packages/pstdio-workbench build-storybook
bun run --cwd packages/e2e test:ui -- src/ui/workbench-windowing.spec.ts
```

The fixture uses today's workbench APIs. New ownership, policy, and layout behavior belongs to the later panel tickets. The Storybook itself has no database; the UI runner uses its existing isolated test runtime and shared Storybooks. A fresh checkout needs built SDK, UI, and workbench dependencies before running it.

See [design rules](../../../design/DESIGN.md), [UI package guidance](../../../packages/ui/README.md), and [testing](0002-testing.md).
