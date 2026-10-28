# @pstdio/ui Agent Instructions

Use the live Canvas designs as the source of truth for appearance, component states, and example prop usage. Follow the project's Canvas policy: update the relevant design first when enabled and available; otherwise follow the existing design workflow and record the skipped step. Read [Canvas coverage](../../documentation/guides/development/0003-canvas-coverage.md).

- Start from [Foundations](src/docs/agents/foundations.mdx) for tokens and density rules.
- Use [Component Map](src/docs/agents/component-map.mdx) to choose components and [Patterns](src/docs/agents/patterns.mdx) for composed flows.
- Use [Preview Authoring](src/docs/agents/story-authoring.mdx) when adding or changing examples.
- Verify props against source types and the canvas's Props and source details.
- Prefer exported `@pstdio/ui` components when an equivalent exists.
- Keep examples in colocated `*.canvas.tsx` files. Use deterministic local fixtures and meaningful interaction checks.
- Rebuild with `bun run --cwd scripts canvas:build`, then run `canvas:coverage` and the relevant isolated browser checks.

## Styling

Visuals belong in the theme, not at the call site:

- Recipes live in [`src/theme/recipes/`](src/theme/recipes/) and are registered in [`src/theme/theme.ts`](src/theme/theme.ts). Style components through their recipe `variant`/`size` props.
- Tokens live in [`src/theme/primitives/`](src/theme/primitives/) (colors, fonts, sizes) and [`src/theme/tokens/`](src/theme/tokens/) (semantic colors, borders, `textStyles`, `layerStyles`). Use them instead of literal values.
- A new look that no recipe or token expresses means one is missing: add the variant or token here — matching the live canvas — so every consumer inherits it.

❌ Not allowed:

- Custom CSS files, `styled` wrappers, or inline `style={{ ... }}` objects for design-system visuals
- Hardcoded colors, font sizes, spacing, or radii instead of tokens
- Per-call-site style overrides that re-implement what a recipe variant should own
