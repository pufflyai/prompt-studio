# Navigation

Switch between your tools and keep useful views open.

## What navigation gives you

Every tool in a project shares one workbench. The sidebar lists your tools and their items, and the panels around the main view hold tabs you want to keep in sight, such as a chat next to a ticket.

The workbench has three panel regions. **Main** shows the page you are on. **Side** and **Secondary** (the bottom panel) hold extra tabs. Tabs in Side and Secondary stay open while you move between pages in the same mode. Tabs in Main belong to the page where you opened them, and come back when you return to it.

Prompt Studio remembers your layout per project. Back and Forward work like in a browser, and each page has its own address, so a link opens the same page and item again.

## Use navigation in Prompt Studio

- **Sidebar.** Choose a tool or item to open it in Main. Sidebar entries can be grouped; use **New group** in the sidebar menu to add your own group.
- **Tabs.** Drag a tab to another panel or position. A link to another item opens as a preview tab, and the next preview in that panel replaces it. Drag the tab, or choose **Pin tab** in its menu, to keep it. **Reset layout** in the same menu restores the default layout.
- **Related items.** When you open a ticket or a workspace, its latest session opens in Side. Turn this off with **Open related resources** in **Settings → Workbench → Appearance**.
- **Panels.** Drag empty header space to move a whole panel to another edge. The fullscreen control expands Main over the workbench.

Keyboard shortcuts:

| Action | Shortcut |
| --- | --- |
| Back, Forward | Alt+Shift+Left, Alt+Shift+Right |
| Back to project from a nested level | Alt+Shift+Up |
| Next or previous tab | Ctrl+Tab, Ctrl+Shift+Tab |
| Select tab 1 to 9 | Alt+Shift+1 to Alt+Shift+9 |
| Toggle the sidebar, Secondary, Side | Alt+Shift+S, Alt+Shift+B, Alt+Shift+E |
| Toggle Main fullscreen | Alt+Shift+Z |

On macOS, Alt is Option. See [Keyboard shortcuts](0016-keyboard-shortcuts.md) for more.

## Navigate from your tool

Navigation always goes to an explicit target. Common targets are a `page`, a `panel`, a `dialog` that shows a page as a form, a `command`, an `href` (external link), and a `compound` of page and panel steps. A page or panel target can name a `resource` and a `region` (`main`, `side`, or `secondary`). Prompt Studio never guesses a screen from a resource type.

- `defineNavigationItem` adds a sidebar entry. Its `group` names a section of the sidebar for your tool.
- `ctx.navigation.open(target)` opens a target from a command or a row action.
- In a webview, declare the `navigation.open` capability and call `client.navigation.open(target)`.
- `relatedOpenings` on `defineResourceKind` names a command that chooses which related items open with yours, and in which panel.

To open another tool's page, import its qualified refs, made with `qualifyRef`, from that tool's public contract.

## Learn more

- [Pages](0001-pages.md) explains views, pages, and sidebar entries.
- [Workbench cookbook](../extensions/0002-workbench-cookbook.md#cross-extension-navigation) shows navigation between tools.
- [Navigation and layout state](../../references/extensions/0010-navigation-and-layout-state.md) describes page locations, panels, and history.
- [Related resource openings](../../references/extensions/0019-related-resource-openings.md) covers `relatedOpenings`.
- [Workbench navigation](../../references/workbench/0004-navigation.md) lists target kinds and panel commands.

*Updated at: 2026-11-22*
