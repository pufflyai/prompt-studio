# Preview authoring

Canvas examples are executable documentation and live design references. Keep them beside their components in `*.canvas.tsx` files.

## Useful variants

Start with the default useful state, then common configurations and supported edge states: empty, loading, disabled, selected, long content, and errors. Group related states as variants of one component frame.

## Source contents

- Use realistic, synthetic data and deterministic local fixtures.
- Preserve stable IDs and existing exports when updating examples.
- Use Canvas-owned authoring types with an explicit stable variant ID. Keep props, providers, and deterministic setup beside the example. Critical behavioral assertions live in Playwright tests.
- Avoid tests that assert generated wording or bundled copy.
- Split growing fixtures into nearby source files.
- For theme changes, review Prompt Light, Prompt Dark, both Prompt Contrast variants, and a partial external theme. Check interactive states on canvas and panels, text selection, portals, and project transitions. Use the same shared theme conversion as runtime code; do not add preview-only palette fixes.

## Metadata and validation

Use concise component and variant descriptions when usage needs more explanation than props and examples provide. Rebuild the Canvas catalog and test only critical interaction risks in the isolated browser. A successful initial render does not prove every user flow. Put a frame's description in `description`, and set `fullscreen: true` when a frame needs the full viewport height.

Examples are design fixtures, not test cases. Add Playwright checks only for critical user behavior; avoid cosmetic, prop, viewport, and theme permutations.

Set `defaultTheme` on the metadata or variant to choose a frame's initial theme. A saved frame choice takes precedence.
