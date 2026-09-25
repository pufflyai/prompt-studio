# @pstdio/ui

Shared React UI package for Prompt Studio apps. This package owns:

- reusable components
- design tokens and Chakra theme configuration
- Storybook stories used as UI test cases

## Run Locally

From repo root:

```bash
bun run storybook:ui
```

From `packages/ui`:

```bash
bun run storybook
```

Build distributable package:

```bash
bun run --cwd packages/ui build
```

Run Storybook tests:

```bash
bun run --cwd packages/ui test-storybook
```

## Package Layout

- `src/components/*`: components and colocated stories (`*.stories.tsx`)
- `src/theme/*`: theme, recipes, tokens, and theme helpers
- `src/index.ts`: public exports for `@pstdio/ui`
- `.storybook/*`: Storybook configuration and Vitest setup

The root entry holds the light, widely reused components. A feature that pulls a
heavy dependency, such as the Lexical editor, Monaco, Mermaid, or the terminal,
gets its own entry: `./rich-text`, `./param-editor`, `./kanban-renderer`,
`./data-table`, `./chat-ui`, `./diff`, `./mermaid`, `./terminal`. Nothing reachable
from the root entry may import one of those, or every consumer's bundler emits the
heavy chunks even when the consumer never renders the feature.

## Contributor Workflow

1. Implement or update the component in `src/components`.
2. Add or update stories next to the component to cover important user-visible states.
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
bun run --cwd packages/ui test-storybook
```

## Story Guidelines

- Treat each story as a reproducible test case for a real UI state.
- Include states like default, loading, empty, error, long content, and disabled where relevant.
- For non-visual behavior, add `play` interactions and assertions in the story.
- Keep stories deterministic: avoid real network calls.
