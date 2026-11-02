# Extra theme comparison

The built-in themes are **Prompt Light**, **Prompt Dark**, **Prompt Contrast Light**,
and **Prompt Contrast Dark**. The first two retain the stored IDs `pstdio-light`
and `pstdio-dark`; existing choices do not need migration. Contrast themes live
in the shared UI package and remain available while project extensions load.
The Canvas examples `Foundations/Component Gallery` and `Patterns/Chat/Message Surfaces`
include contrast variants as well as normal light and dark variants.

The comparison Canvas belongs to `extensions/pstdio-base-themes`. It renders Solarized Light, Solarized Dark, Dracula, and Monokai side by side using the shipped theme assets and the public UI components.

Open Design System → Themes in Canvas, or search for the theme comparison. Use its frames for surfaces, buttons, forms, navigation, feedback, overlays, and composed controls. Each frame also has an independent Theme menu.

Each comparison column uses a separate document. Theme classes, color mode, CSS variables, focus, and portals stay local to that column. Menus, dialogs, drawers, popovers, and tooltips use the same theme as their trigger. On narrow screens, scroll horizontally to compare readable columns.

## Theme color roles

VS Code `colors` provide the editor palette and the application's standard mapped roles. The optional `pstdio.colors` object in the same JSON asset supplies application roles without a VS Code equivalent:

```json
{
  "pstdio": {
    "colors": {
      "border.subtle": "#31515A",
      "border.accent-light": "#2AA198",
      "bg.button.primary.pressed": "#238E86"
    }
  }
}
```

The shared converter prefixes these keys with `colors.` and applies them after the VS Code mapping. Both the runtime and public UI importer use that converter. Monaco receives only VS Code colors and syntax rules. The conversion supports partial themes with derived surface and interaction colors; application overrides remain authoritative.

## New-theme checklist

- Review both modes and every state on canvas and panel surfaces. Include missing colors, flat palettes, and alpha colors in importer coverage.
- Pair menu selection backgrounds with their foregrounds. Check app text selection, editor selections, syntax, diffs, and every terminal ANSI color.
- Check portalled menus, dialogs, popovers, tooltips, and extension iframes.
- Preview a theme, cancel, choose another, reload, and remove its extension. Confirm no contributed color survives after returning to a built-in theme.
- Switch projects while contributions load slowly, fail, or arrive out of order. Keep the last resolved appearance until the destination catalog settles. A failed load keeps the previous appearance; a successful catalog can confirm that a theme was removed. Keep saved choices intact while their themes are pending.
- Validate the shipped packages, not only source imports. See [supported theme asset formats and role precedence](../../references/extensions/0004-contribution-api.md#appearance-contributions).

Use the same roles in every extra theme:

- Separate the canvas, panel, muted, hover, and selected surfaces. Hover must remain visible on both canvas and panel surfaces.
- Give primary buttons distinct default, hover, and pressed colors. Keep normal text at least 4.5:1 against its background in each state.
- Keep primary and secondary text at least 4.5:1 on the neutral surfaces. Disabled controls are exempt; placeholders still need readable contrast.
- Keep selected text at least 4.5:1 against its highlight. Dark themes use an accent highlight with inverted text.
- Keep control borders at least 3:1 against their resting surfaces. Use the theme's hue for subtle separators and accent borders.
- Keep focus borders, inverted surfaces, and status surfaces inside the theme palette.

The Canvas variants show default, hover, pressed, focus, disabled, loading, invalid, checked, mixed, and selected states. Comparison previews keep their controls at rest until you interact with them. Check critical selection and keyboard behavior with the Canvas Playwright harness.

## Build and package boundaries

```sh
bun run --cwd extensions/pstdio-base-themes typecheck
bun x pstdio-canvas build
bun run --cwd packages/canvas-tests test
```

UI and preview tooling are development dependencies. `extension.ts` imports only the SDK. The package file list includes its entry point, themes, and icons; it excludes preview sources and test output. Git installs retain the extension lockfile.
