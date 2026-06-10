# @pstdio/ui Agent Instructions

Use Storybook as the source of truth before composing UI with this package.

- Query the `@pstdio/ui` Storybook MCP server when it is available.
- Start from `Agent Guide/Component Map` to choose components and `Agent Guide/Patterns` for multi-component flows.
- Verify component props with Storybook documentation or source types before using them.
- Prefer exported `@pstdio/ui` components over raw Chakra primitives when an equivalent exists.
- Add or update colocated stories for user-visible UI states.
- Put canonical stories first; Storybook MCP surfaces the first few stories most prominently.
- Exclude performance, regression-only, and fixture-only stories from agent manifests with `tags: ["!manifest"]`.
- Keep stories deterministic and avoid network calls.
- Use `bun run --cwd packages/ui build-storybook` to verify Storybook documentation changes.
