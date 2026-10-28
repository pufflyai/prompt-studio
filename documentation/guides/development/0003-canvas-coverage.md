# Canvas coverage

Canvas owns UI designs, component state examples, and prop usage. Put source examples beside their components in `*.canvas.tsx` files. Keep existing scenario IDs and exports stable. Related examples share a topic canvas, with predefined variants beside Theme.

## Choosing examples

1. Start with the normal useful state.
2. Include supported loading, empty, disabled, error, and long-content states.
3. Exercise meaningful outcomes: open a menu, edit a value, submit a form, switch a resource, or close a panel.
4. Assert roles and visible state. Avoid tests that only repeat literal copy.
5. Keep shared component behavior in shared examples; product flows belong in browser journeys.

## Authoring and checks

Use the [Canvas skill](../../../.pstdio/extensions/canvas/skills/canvas/SKILL.md). Update the relevant live design before production UI work and link its page, exact preview names, and source paths in the ticket.

```sh
bun run --cwd scripts canvas:build
bun run --cwd scripts canvas:inventory
bun run --cwd scripts canvas:coverage
bun run --cwd .pstdio/extensions/canvas test
bun run --cwd .pstdio/extensions/canvas typecheck
```

Open canvases with `pst canvas open --canvas <id>`. Inspect Theme, Variant, Props and source, and real interactions. The first click selects a frame; the next interacts with its contents. Verify focus, sizing, navigation, state retention, and resource switching in the isolated app.

Run `bun run --cwd scripts canvas:verify` in the isolated Docker tools container to check live variants. Browser interaction tests remain in `packages/canvas-tests`; their static preview build is a test fixture, not another developer catalog. For one existing test, use `bun run --cwd packages/canvas-tests test:browser -- src/ui/pstdio-workbench/panel-tabs.p1.spec.ts`.

Source and output hashes detect stale builds, and the source inventory detects missing original scenarios. Rendering alone does not prove editing, validation, persistence, accessibility, or visual fidelity. Report unavailable physical-device checks separately.

See [design rules](../../../design/DESIGN.md), [UI guidance](../../../packages/ui/README.md), and [testing](0002-testing.md).
