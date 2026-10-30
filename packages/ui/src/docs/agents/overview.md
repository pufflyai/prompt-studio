# Agent Guide

`@pstdio/ui` is the shared React and Chakra UI package for Prompt Studio surfaces. Treat UI Canvas as the source of truth for available components, patterns, design tokens, examples, and usage constraints.

## Agent workflow

1. Inspect the live Canvas examples before writing UI.
2. Use Chakra components directly when `psTheme` provides the recipe or token styling for that primitive.
3. Verify props through Canvas descriptions, source types, or canvas examples before using them.
4. Use canvas examples to inspect realistic states, then compose the smallest UI that matches the existing patterns.
5. Add or update colocated canvas examples for user-visible UI changes.

## Component sources

`@pstdio/ui` intentionally uses Chakra as part of the public composition surface. Import recipe-backed primitives such as
`Button`, `Input`, `Textarea`, `Menu`, `Popover`, `Field`, and `InputGroup` from `@chakra-ui/react`; update the local theme
recipes when their shared styling needs to change. Prefer exported `@pstdio/ui` components for custom behavior, richer
product patterns, and package-owned composites.

## Do not guess

Do not invent component props from common design-system conventions. If a prop is not documented or shown in source types, do not use it. Choose a supported prop, compose with Chakra layout primitives, or ask for product direction.

## Where to look

- `Agent Guide/Foundations`: tokens, theme, layout, and styling rules.
- `Agent Guide/Component Map`: component categories and default choices.
- `Agent Guide/Patterns`: higher-level workflows and composed UI.
- `Agent Guide/Preview Authoring`: example structure and coverage rules.
- `Foundations/Component Gallery / Foundations`: lightweight components, tokens, and primitive states.
- `Foundations/Component Gallery / Composites`: advanced component examples for assembled product workflows.
