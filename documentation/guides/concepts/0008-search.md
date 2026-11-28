# Search

Find a tool, something a tool made, or a command from one place.

## Open search

Press **Mod+P** (Cmd+P on macOS, Ctrl+P elsewhere), or choose **Search** in the sidebar. Type to narrow the list, then press Enter or click a row.

## What search finds

- **Tools.** Every page your installed extensions add, so you can open a tool without finding it in the sidebar.
- **Things your tools make.** Extensions can list their own items, such as notes or tickets, in search.
- **Commands.** Actions from Prompt Studio and from your extensions. A command without a keyboard shortcut is still available here, and commands that have one show it as a hint.

**Reopen latest tab** in search restores the most recently closed tab in the current project.

## Find in a Markdown document

With the editor focused, press **Cmd+F** on macOS or **Ctrl+F** on Windows or Linux.
Find searches the visible text of that editor, including text with inline formatting.
Press **Enter** for the next match, **Shift+Enter** for the previous match, or **Escape** to close Find and return to the editor.

## Add your tool to search

An extension lists its items with the `commandPaletteResources` contribution; its commands appear with their labels and shortcut hints. See [Contributions](../../references/extensions/0004-contribution-api.md#contribution-surfaces) and [Commands and processes](../../references/extensions/0003-command-and-process-api.md).

*Updated at: 2026-11-20*
