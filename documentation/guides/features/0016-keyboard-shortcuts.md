# Keyboard shortcuts

Shared shortcuts to create and go to things work the same in every tool.

## What shortcuts give you

Prompt Studio has one shortcut system for all your tools. Instead of each tool picking its own keys, tools add their actions to shared groups. You learn one pattern, such as "C then N" to create a note, and it works the same way for every tool you install.

There are two kinds of shortcuts:

- **Direct chords** work anywhere, such as **Mod+P** for search. Mod is Cmd on macOS and Ctrl elsewhere.
- **Shortcut mode** sequences start with **Alt+Shift+Space** (Option+Shift+Space on macOS), then a group key, then the action key.

## Use shortcuts in Prompt Studio

Press **Alt+Shift+Space** to enter shortcut mode. A small bubble at the bottom of the window shows the keys you pressed so far. Then choose a group:

| Key | Group | Example |
| --- | --- | --- |
| V | View | Tab and view actions |
| G | Go | G → E opens Extensions |
| C | Create | C → N creates a note, C → T a ticket, C → A an artifact |
| A | Current view | Actions for what is visible, such as renaming the open note |
| S | Settings | S → I opens appearance settings |

When two actions share a key, Prompt Studio shows numbered choices. When an action could apply to several visible items, it asks which one. A finished action leaves shortcut mode; Escape leaves it at any time.

Hold **Alt** to see the direct chords on tabs, sidebar rows, and menus. **Mod+/** opens **Keyboard shortcuts**, a searchable list of every assigned action. You can also find it under Help.

Common direct chords:

| Action | Shortcut |
| --- | --- |
| Search | Mod+P |
| Run a command | Alt+Shift+K |
| Choose a color theme | Alt+Shift+T |
| Open Extensions | Alt+Shift+O |
| Open settings | Mod+, |
| New session | Mod+Alt+S |
| Back, Forward | Alt+Shift+Left, Alt+Shift+Right |
| Select tab 1 to 9 | Alt+Shift+1 to Alt+Shift+9 |
| Next or previous tab | Ctrl+Tab, Ctrl+Shift+Tab |

Search shows each command's shortcut as a hint. See [Navigation](0012-navigation.md) for panel and tab shortcuts.

## Add shortcuts to your tool

Declare shortcuts with `defineKeybinding` in the `keybindings` contribution. A shortcut runs a navigation `action`: a command, a page, or a panel. To join a shared group, set `layer` to `go`, `create`, `current`, `view`, or `settings`, and set `key` to one letter or number. This shortcut, adapted from the Notes extension, creates a note with C → N:

```ts
defineKeybinding({
  id: "create-note",
  layer: "create",
  key: "N",
  action: { kind: "command", target: { command: createNoteCommand.ref, params: {} } },
});
```

A create shortcut uses the first letter of the resource kind it creates. For actions on the visible item, use the `current` layer with `targetScope: "resource"` and a `when` condition. A direct chord must hold Alt, Ctrl, or Cmd; Prompt Studio refuses one that would type text. Prefer `Mod+...` chords, and avoid ones the browser or system already uses, such as `Mod+T` or `Mod+W`.

## Learn more

- [Keyboard shortcuts reference](../../references/workbench/0006-keyboard.md) describes shortcut mode, groups, and conflicts.
- [Extension keyboard shortcuts](../../references/workbench/0007-extension-shortcuts.md) lists the defaults of first-party tools.
- [Keybindings](../../references/extensions/0004-contribution-api.md#keybindings) covers `defineKeybinding` options and checks.

*Updated at: 2026-11-22*
