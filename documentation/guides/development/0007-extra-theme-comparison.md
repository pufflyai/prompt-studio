# Extra theme comparison

The comparison Canvas belongs to `extensions/pstdio-base-themes`. It renders Solarized Light, Solarized Dark, Dracula, and Monokai side by side using the shipped theme assets and the public UI components.

Open Design System → Themes in Canvas, or search for the theme comparison. Use its predefined variants for surfaces, buttons, forms, navigation, feedback, overlays, and composed controls. Each frame also has an independent Theme menu.

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

The extension runtime prefixes these keys with `colors.` and applies them after the VS Code mapping. Monaco receives only VS Code colors and syntax rules. Existing external VS Code themes keep their normal mapping. The preview uses the public UI importer plus these asset-owned application roles, matching the runtime. There are no preview-only palette overrides.

Use the same roles in every extra theme:

- Separate the canvas, panel, muted, hover, and selected surfaces. Hover must remain visible on both canvas and panel surfaces.
- Give primary buttons distinct default, hover, and pressed colors. Keep normal text at least 4.5:1 against its background in each state.
- Keep primary and secondary text at least 4.5:1 on the neutral surfaces. Disabled controls are exempt; placeholders still need readable contrast.
- Keep selected text at least 4.5:1 against its highlight. Dark themes use an accent highlight with inverted text.
- Keep control borders at least 3:1 against their resting surfaces. Use the theme's hue for subtle separators and accent borders.
- Keep focus borders, inverted surfaces, and status surfaces inside the theme palette.

The stories show default, hover, pressed, focus, disabled, loading, invalid, checked, mixed, and selected states. The check stories exercise selection and tab changes and verify text contrast and visible hover feedback in all four themes. Comparison previews keep their controls at rest until you interact with them.

## Build and package boundaries

```sh
bun run --cwd extensions/pstdio-base-themes typecheck
bun run --cwd scripts canvas:build
bun run --cwd scripts canvas:verify
```

UI and preview tooling are development dependencies. `extension.ts` imports only the SDK. The package file list includes its entry point, themes, and icons; it excludes preview sources and test output. Git installs retain the extension lockfile.
