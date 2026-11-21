# Themes

Every tool in Prompt Studio follows the theme you choose.

## Choose a theme

Press **Alt+Shift+T** (Option+Shift+T on macOS) to choose a color theme. In shortcut mode, opened with Alt+Shift+Space, **Settings → I** opens the appearance and file icon themes.

New projects include the **Themes** extension. It adds the Monokai, Solarized and Dracula color themes and the Seti file icon theme, next to Prompt Studio's own light and dark themes.

## Themes and your tools

Tools built with `@pstdio/ui` use the shared theme tokens, so their pages change with the theme you pick. You don't set colors per tool.

## Add a theme

An extension contributes color themes in the VS Code color theme format, and file icon themes, through its `themes` and `fileIconThemes` contributions. Every theme provider adds to the same picker; none adds its own shortcut. See [Appearance contributions](../../references/extensions/0004-contribution-api.md#appearance-contributions).

*Updated at: 2026-11-20*
