# Canvas coverage

Canvas owns UI designs, component state examples, and prop usage. Put source examples beside their components in `*.canvas.tsx` files. Keep existing scenario IDs and exports stable. A canvas file's default export holds `title`, `component`, `args`, `description`, and `decorators`; each exported frame can set `name`, `args`, `render`, `description`, `fullscreen`, and `setup`. Storybook fields such as `parameters`, `argTypes`, `tags`, and `play` are not supported. Related examples share a topic canvas, with predefined variants beside Theme.

## Choosing examples

1. Start with the normal useful state.
2. Include supported loading, empty, disabled, error, and long-content states.
3. Keep examples interactive for exploration. Add tests only for critical user outcomes.
4. In critical tests, assert roles and visible outcomes; identify the risk. Avoid cosmetic and repeated prop assertions.
5. Keep shared component behavior in shared examples; product flows belong in browser journeys.

## Authoring and checks

Use the [Canvas skill](../../../extensions/canvas/skills/canvas/SKILL.md). Update the relevant live design before production UI work and link its page, exact preview names, and source paths in the ticket.

```sh
bun run --cwd scripts canvas:build
bun run --cwd extensions/canvas test
bun run --cwd extensions/canvas typecheck
```

Prompt Studio also builds its canvases with `@pstdio/canvas`, like any other project. `bun run canvas` starts `pstdio-canvas watch` at the repository root, which rebuilds into `.pstdio/extension-storage/pstdio.canvas/build` whenever a canvas or a file it uses changes. `bun x pstdio-canvas build` builds once and lists any canvas that fails. UI Canvas reads this build once it adopts the package; until then it shows the catalog that `canvas:build` creates.

Open canvases with `pst canvas open --canvas <id>`. Inspect Theme, Variant, Props and source, and real interactions. The first click selects a frame; the next interacts with its contents. Verify only affected critical behavior in the isolated app. Routine copy, spacing, cosmetic, and documentation changes require no browser runs or screenshots.

Run `bun run --cwd scripts canvas:verify` in the isolated Docker tools container to check representative critical Canvas contracts. Browser interaction tests remain in `packages/canvas-tests`; their static preview build is a test fixture, not another developer catalog. For one existing test, use `bun run --cwd packages/canvas-tests test:browser -- src/ui/pstdio-workbench/critical-workbench.p1.spec.ts`.

Source and output hashes detect stale builds. Rendering alone does not prove editing, validation, persistence, accessibility, or visual fidelity. Report unavailable physical-device checks separately.

See [design rules](../../../design/DESIGN.md), [UI guidance](../../../packages/ui/README.md), and [testing](0002-testing.md).

Screenshot comparisons are reserved for critical appearance contracts that behavioral assertions cannot establish. Keep the visual catalog without a test per example. Preserve explicit user-requested visual checks.
