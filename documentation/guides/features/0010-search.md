# Search

Find files, open tools, and run commands from one search.

## What search gives you

Search is one list for everything you can open or run in a project. You do not need to remember where a tool keeps its things, or which menu holds an action.

Search finds:

- **Tools.** Every page your enabled extensions add, so you can open a tool without finding it in the sidebar.
- **Files.** With the Workspaces extension enabled, **Workspace files** lists files in the open workspace, or in the project's default workspace. It covers local workspaces only.
- **Things your tools make.** Tools list their own items, such as notes, artifacts, and canvases.
- **Commands.** Actions from Prompt Studio and from your tools. A command without a keyboard shortcut is still available here, and commands that have one show it as a hint.

## Use search in Prompt Studio

Press **Mod+P** (Cmd+P on macOS, Ctrl+P elsewhere), or choose **Search** in the sidebar. Type to narrow the list, then press Enter or click a row. Mod+P also works while you type in an editor.

To see only commands, start the query with `>`. **Alt+Shift+K** opens search with `>` already typed. **Alt+Shift+T** opens the theme list in the same search.

A few useful entries:

- **Reopen latest tab** restores the most recently closed tab in the current project.
- **Related resources** shows what the current item is linked to. See [Links between tools](0013-links.md).
- **Open notifications** opens your inbox when notifications are turned on. See [Notifications](0011-notifications.md).

When a command needs you to pick a resource, such as a workspace or a ticket, it opens the same kind of search to choose it.

## Add your tool to search

A tool adds commands to search with the `palette` option on `defineCommand`. It lists its own items with `defineCommandPaletteResource` in the `commandPaletteResources` contribution. This excerpt comes from the Artifacts extension:

```ts
export const artifactResources = defineCommandPaletteResource({
  id: "artifacts",
  title: "Artifacts",
  resourceKind: artifact.ref,
  refreshEvents: [changedEvent],
  async query(ctx, input) {
    const artifacts = await serviceFor(ctx).list(input.query);
    return {
      items: artifacts.slice(0, input.limit).map((item) => ({
        id: item.artifactId,
        label: item.title,
        icon: "file-code",
        target: item.target,
      })),
    };
  },
});
```

`query` receives the typed text, a `limit`, and the `activeResource` the person is looking at. Each item has an `id`, a `label`, and a navigation `target`. It can also have a `description`, an `icon`, `keywords`, and an `indicator` that shows its current status. `refreshEvents` names the events after which search asks again. Set `resourceKind` so commands that need a resource of that kind can offer your items as choices.

## Learn more

- [Contributions](../../references/extensions/0004-contribution-api.md#contribution-surfaces) describes `commandPaletteResources`.
- [Commands and processes](../../references/extensions/0003-command-and-process-api.md#commands) covers command options and resource parameters.
- [Commands](0003-commands.md) explains how one command runs from search, menus, and the terminal.
- [Keyboard shortcuts](0016-keyboard-shortcuts.md) lists the shortcuts that search shows as hints.

*Updated at: 2026-11-22*
