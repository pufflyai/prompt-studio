# Canvas coverage

Canvas owns UI designs, component state examples, and prop usage. Put source examples beside their components in `*.canvas.tsx` files. Keep retained scenario IDs and exports stable. A canvas file's default export holds `title`, `component`, `args`, `description`, and `decorators`; each named export is one frame and can set `name`, `args`, `render`, `description`, `fullscreen`, and `defaultTheme`. Storybook fields such as `parameters`, `argTypes`, `tags`, and `play` are not supported. Each canvas file is one canvas.

## Catalog organization

Use these five top-level categories in this repository. UI Canvas derives folders from titles, so a category appears when it contains an example. Other projects choose their own categories.

| Category | Contents |
| --- | --- |
| Design system | Foundations, reusable components, and reusable interaction patterns. |
| Product | Workbench, projects, sessions, settings, desktop, and host API examples. |
| Extensions | Examples grouped by the readable name of the extension people use. |
| Website | Landing pages, documentation layouts, and website brand examples. |
| Proposals | Active alternatives under a ticket and readable feature name. |

Use sentence case, preserving product names and acronyms such as UI Canvas, Prompt Studio Dev, API, HTML, and JSON. Choose the home by the example's purpose: a shared Tree list is a design-system component, workbench navigation belongs to Product, and a Planner timeline belongs to Extensions. Source folders need not match display categories.

Give each canvas a unique full title. For a subject with several canvases, put its main example at `Overview` and name specialized examples by behavior, such as `Design system/Components/Data display/Data table/JSON cells`. Keep a single-canvas subject direct, such as `Design system/Components/Forms/Button`. Use short frame state names where possible; retain meaningful interaction, error, and platform distinctions.

Compare actual behavior before retiring a duplicate. Similar titles alone do not prove duplication. The Data table JSON, color scale, loading, and value-renderer examples, and the horizontal Parameter editor resource example, cover distinct scenarios and keep their own named entries. Galleries and cross-component state comparisons also have a distinct purpose.

Changing a title or frame's display `name` preserves saved work because canvas identity is its relative source path and frame identity is its export name. Keep both stable during naming cleanup. Do not move sources or exports for cosmetic consistency. When the user requests consolidation, retain the primary frame export and its saved arrangement, and record each retired export with the retained frame and navigation choice that replace it. Leave stored layout entries intact. Retired frames no longer have separate visible positions or themes; all their states share the retained frame's arrangement. A title change alone is not consolidation.

Put new alternatives in `proposals/<ticket>/` under their owning package, titled `Proposals/<ticket> <feature>`. Keep shipped examples in their normal home. Apply accepted changes to production and remove the proposal folder in the same change. The retained frame-editor workflow study demonstrates local parameter and playback behavior under `Extensions/UI Canvas/Frame editor workflow`; it is no longer an active alternative.

## Choosing examples

1. Start with the normal useful state.
2. Make supported loading, empty, disabled, error, and long-content states reachable in the same frame. Unless the user asks otherwise, create separate frames only for things that cannot be reached by navigating within a frame. Prefer real navigation and state controls; use a variant selector for component examples.
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

Open canvases with `pst canvas open --canvas <canvas file>`. Inspect Theme and, for frames that declare `controls`, the Frame editor's parameters and Props JSON, plus real interactions. The first click selects a frame; the next interacts with its contents. Verify only affected critical behavior in the isolated app. Routine copy, spacing, cosmetic, and documentation changes require no browser runs or screenshots.

Run `bun run --cwd packages/canvas-tests test` in the isolated Docker tools container to check representative critical Canvas contracts. It builds Prompt Studio with `pstdio-canvas build` and renders that build through UI Canvas's own view code. To run one existing test, build the verification previews first, because `test:browser` uses whatever build it finds:

```sh
bun run --cwd packages/canvas-tests build:previews
bun run --cwd packages/canvas-tests test:browser -- src/ui/pstdio-workbench/critical-workbench.p1.spec.ts
```

Rendering alone does not prove editing, validation, persistence, accessibility, or visual fidelity. Report unavailable physical-device checks separately.

See [design rules](../../guidance/0002-design.md), [UI guidance](../../../packages/ui/README.md), and [testing](0002-testing.md).

Screenshot comparisons are reserved for critical appearance contracts that behavioral assertions cannot establish. Keep the visual catalog without a test per example. Preserve explicit user-requested visual checks.
