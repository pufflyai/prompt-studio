# @pstdio/ui Agent Instructions

Pencil `.pen` designs are the source of truth for this library's **visuals** (colors, typography, spacing, radii, component states, layout); the code and stories must follow them. The canonical design system is `design/prompt-studio-design-system.pen` at the repo root — open it with the Pencil MCP tools, never by hand. When the design and an implementation disagree, the design wins; when the design itself is wrong, fix it in Pencil first, then the code.

Use Storybook as the source of truth for component **APIs and prop usage** before composing UI with this package.

- Query the `@pstdio/ui` Storybook MCP server when it is available.
- Start from [`Agent Guide/Foundations`](src/docs/agents/foundations.mdx) for tokens and density rules.
- Use [`Agent Guide/Component Map`](src/docs/agents/component-map.mdx) to choose components and [`Agent Guide/Patterns`](src/docs/agents/patterns.mdx) for multi-component flows.
- Use [`Agent Guide/Story Authoring`](src/docs/agents/story-authoring.mdx) when adding or changing stories.
- Verify component props with Storybook documentation or source types before using them.
- Prefer exported `@pstdio/ui` components over raw Chakra primitives when an equivalent exists.
- Add or update colocated stories for user-visible UI states.

## Storybook authoring

- Put canonical stories first; Storybook MCP surfaces the first few stories most prominently.
- Exclude performance, regression-only, and fixture-only stories from agent manifests with `tags: ["!manifest"]`.
- Keep stories deterministic and avoid network calls.
- Use `bun run --cwd packages/ui build-storybook` to verify Storybook documentation changes.

## Styling

Visuals belong in the theme, not at the call site:

- Recipes live in [`src/theme/recipes/`](src/theme/recipes/) and are registered in [`src/theme/theme.ts`](src/theme/theme.ts). Style components through their recipe `variant`/`size` props.
- Tokens live in [`src/theme/primitives/`](src/theme/primitives/) (colors, fonts, sizes) and [`src/theme/tokens/`](src/theme/tokens/) (semantic colors, borders, `textStyles`, `layerStyles`). Use them instead of literal values.
- A new look that no recipe or token expresses means one is missing: add the variant or token here — matching the `.pen` design — so every consumer inherits it.

❌ Not allowed:

- Custom CSS files, `styled` wrappers, or inline `style={{ ... }}` objects for design-system visuals
- Hardcoded colors, font sizes, spacing, or radii instead of tokens
- Per-call-site style overrides that re-implement what a recipe variant should own
