# Themes

Use light, dark, or your own theme across all your tools.

## What themes give you

You pick one theme, and every tool in Prompt Studio follows it: the sidebar, panels, editors, and the pages your tools add. You never set colors per tool. The theme applies to every project.

Prompt Studio has its own light and dark themes. New projects include the **Themes** extension, which adds the Monokai, Solarized Light, Solarized Dark, and Dracula color themes and the Seti file icon theme. Any extension can add more themes, so you can bring your own.

## Choose a theme in Prompt Studio

- Press **Alt+Shift+T** (Option+Shift+T on macOS) to open the theme list in search. Light themes are listed first.
- Or open **Settings → Workbench → Appearance** and choose a **Theme**.
- In shortcut mode (**Alt+Shift+Space**), **S → I** opens the appearance settings.

Every theme appears in the same list, whichever extension adds it.

## Themes and your tool

Tables, boards, forms, and other native views are drawn by Prompt Studio, so they follow the theme without extra work. Tools built with `@pstdio/ui` use the shared theme tokens, so their custom pages change with the theme too. A webview receives the current `themePreference` in its render props.

## Add a theme to your tool

An extension contributes color themes with `defineTheme` in the `themes` contribution, and file icon themes with `defineFileIconTheme` in the `fileIconThemes` contribution. Color themes use the VS Code color theme format, so you can start from an existing VS Code theme file:

```ts
import { defineExtension, defineTheme, packageAsset } from "@pstdio/sdk/extensions";

const monokai = defineTheme({
  id: "monokai",
  title: "Monokai",
  format: "vscode-color-theme",
  mode: "dark",
  source: packageAsset("./themes/monokai.json", import.meta.url),
});

export default defineExtension({ themes: [monokai] });
```

Prompt Studio maps the VS Code colors to its own roles and sends editor colors and syntax rules to the code editor. A `pstdio.colors` section in the theme file overrides individual roles. Set `mode` to `light` or `dark`. Inline any `include` files first; Prompt Studio does not load them. An invalid theme is skipped with a diagnostic, and the other themes still load.

A theme extension does not add its own shortcut. All themes share Alt+Shift+T. A mode can name a theme as its `defaultTheme`.

## Learn more

- [Appearance contributions](../../references/extensions/0004-contribution-api.md#appearance-contributions) explains the color mapping and supported theme files.
- [Themes concept](../concepts/0009-themes.md) summarizes how themes apply.
- [Themes extension source](../../../extensions/pstdio-base-themes/extension.ts) shows four color themes and a file icon theme.

*Updated at: 2026-11-22*
