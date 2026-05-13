---
"pstdio": minor
---

Add `shell.commandPalette` controller (`open`, `close`, `toggle`, `isOpen`, `onDidChange`). `ShellWorkbench` reads palette state from the controller; the workbench drops `commandPaletteOpen`, `initialCommandPaletteOpen`, `onCommandPaletteOpenChange`, and `showCommandPaletteTreeNode` props. The synthetic "Commands" tree-view node is removed — open the palette via `shell.commandPalette.open()` from a keybinding or menu action instead.
