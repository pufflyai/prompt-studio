# Canvas coverage

Canvas owns UI designs, component state examples, and prop usage. Put source examples beside their components in `*.canvas.tsx` files. Keep existing scenario IDs and exports stable. A canvas file's default export holds `title`, `component`, `args`, `description`, and `decorators`; each named export is one frame and can set `name`, `args`, `render`, `description`, `fullscreen`, and `defaultTheme`. Storybook fields such as `parameters`, `argTypes`, `tags`, and `play` are not supported. Each canvas file is one canvas.

## Choosing examples

1. Start with the normal useful state.
2. Include supported loading, empty, disabled, error, and long-content states.
3. Keep examples interactive for exploration. Add tests only for critical user outcomes.
4. In critical tests, assert roles and visible outcomes; identify the risk. Avoid cosmetic and repeated prop assertions.
5. Keep shared component behavior in shared examples; product flows belong in browser journeys.

## Authoring and checks

Use the [Canvas skill](../../../extensions/canvas/skills/canvas/SKILL.md). Update the relevant live design before production UI work and link its page, exact preview names, and source paths in the ticket.

Start the watcher in its own terminal; it keeps running until you stop it:

```sh
bun run canvas
```

Run the checks in another terminal:

```sh
bun run --cwd packages/canvas-tests typecheck
bun run --cwd extensions/canvas test
```

Prompt Studio builds its canvases with `@pstdio/canvas`, like any other project. `bun run canvas` starts `pstdio-canvas watch` at the repository root, which rebuilds into `.pstdio/extension-storage/pstdio.canvas/build` whenever a canvas or a file it uses changes. UI Canvas reads that folder and reloads the frames whose code changed. `bun x pstdio-canvas build` builds once and lists any canvas that fails. `packages/canvas-tests` type-checks every canvas file with its owning package's settings.

Open canvases with `pst canvas open --canvas <canvas file>`. Inspect Theme, Props and source, and real interactions. The first click selects a frame; the next interacts with its contents. Verify only affected critical behavior in the isolated app. Routine copy, spacing, cosmetic, and documentation changes require no browser runs or screenshots.

Run `bun run --cwd packages/canvas-tests test` in the isolated Docker tools container to check representative critical Canvas contracts. It builds Prompt Studio with `pstdio-canvas build` and renders that build through UI Canvas's own view code. To run one existing test, build the verification previews first, because `test:browser` uses whatever build it finds:

```sh
bun run --cwd packages/canvas-tests build:previews
bun run --cwd packages/canvas-tests test:browser -- src/ui/pstdio-workbench/critical-workbench.p1.spec.ts
```

Rendering alone does not prove editing, validation, persistence, accessibility, or visual fidelity. Report unavailable physical-device checks separately.

See [design rules](../../../design/DESIGN.md), [UI guidance](../../../packages/ui/README.md), and [testing](0002-testing.md).

Screenshot comparisons are reserved for critical appearance contracts that behavioral assertions cannot establish. Keep the visual catalog without a test per example. Preserve explicit user-requested visual checks.
