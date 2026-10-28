# @pstdio/ui

Shared React UI package for Prompt Studio apps. This package owns:

- reusable components
- design tokens and Chakra theme configuration
- Canvas examples used as UI test cases

## Work with the live catalog

Browse Design System in the Canvas extension. Open a component canvas and use Variant, Theme, and Props and source to inspect its states and public API.

```sh
bun run --cwd packages/ui build
bun run --cwd scripts canvas:build
bun run --cwd scripts canvas:coverage
bun run --cwd extensions/canvas test
```

See [Canvas coverage](../../documentation/guides/development/0003-canvas-coverage.md) for authoring and isolated browser checks.

## Package Layout

- `src/components/*`: components and colocated examples (`*.canvas.tsx`)
- `src/theme/*`: theme, recipes, tokens, and theme helpers
- `src/index.ts`: public exports for `@pstdio/ui`
- `.canvas/*`: suite providers and test-only preview configuration

The root entry holds the light, widely reused components. A feature that pulls a
heavy dependency, such as the Lexical editor, Monaco, Mermaid, or the terminal,
gets its own entry: `./rich-text`, `./param-editor`, `./kanban-renderer`,
`./data-table`, `./chat-ui`, `./diff`, `./mermaid`, `./terminal`. Nothing reachable
from the root entry may import one of those, or every consumer's bundler emits the
heavy chunks even when the consumer never renders the feature.

Code and diff editors follow the active theme preference, including live theme previews.
Themes can supply a `monacoTheme` palette. Otherwise, the editors use the built-in
light or dark palette for the preference's color mode.

## Chat Layout

`ChatPanel` fills its parent pane. The transcript and composer share a centered
column with a maximum width of `52rem`, defined by the `chat-content` size token
and `chatContent` layer style. Narrow panes use their available width. Keep the
scroll area at the full pane width so its scrollbar stays at the pane edge.

The [chat width stories](src/components/chat-ui/components/chat-panel-width.canvas.tsx)
cover wide, narrow, and empty panes. Use these live previews as the design reference.

## Contributor Workflow

1. Implement or update the component in `src/components`.
2. Add or update Canvas examples next to the component to cover important user-visible states.
3. If the component is public, export it from `src/index.ts`, or from the entry that owns its heavy dependency.
4. If you add a new package entrypoint, update `package.json#exports`.
5. Run validations before opening a PR.

## Validation Checklist

From repo root:

```bash
bun run format
bun run lint
bun run build
bun run test
```

UI-specific check:

```bash
bun run --cwd scripts canvas:verify
```

## Example guidelines

- Treat each example as a reproducible test case for a real UI state.
- Include states like default, loading, empty, error, long content, and disabled where relevant.
- For non-visual behavior, add `play` interactions and assertions in the example.
- Keep examples deterministic: avoid real network calls.
