# Pages

A page gives your tool its own screen in Prompt Studio, such as a dashboard, a board, a form, or a custom view.

## What a page gives you

A page has its own address in the project. It shows one main view and can add extra panels beside it, such as an inspector. Your data stays in the extension; the page only presents it.

A page can show:

- **A table.** Rows with columns, filters, sorting, and saved tabs such as **All** and **Unread**.
- **A board.** Cards in columns, like a Kanban board.
- **A form.** Typed fields whose changes the extension saves.
- **A custom view.** A webview: a web page the extension draws itself, for dashboards or anything the built-in views do not cover.

Tables, boards, and forms are native views. Prompt Studio draws them, so they look like the rest of the workbench and follow your theme.

## Use pages in Prompt Studio

Enabled tools add their pages to the sidebar. You can also press **Mod+P** (Cmd+P on macOS, Ctrl+P elsewhere) and search for a tool by name: search lists every tool (top-level page) your enabled extensions add.

The workbench has three panel regions: Main, Side, and Secondary. A page fills Main, and its extra panels open in Side or Secondary. You can drag tabs between panels. Hover over a tab, or focus it with the keyboard, to see its full title.

Table and board actions run the tool's commands. A toolbar button can open a form, a row menu can act on one row, and a selection action can act on several rows. A change made from the terminal shows up in an open table without a reload when the tool declares a refresh event.

## Add a page to your tool

An extension declares a view with `defineView`, places it on a page with `definePage`, and adds a sidebar entry with `defineNavigationItem`. This excerpt comes from the Bookmarks tutorial:

```ts
export const bookmarksPage = definePage({
  id: "bookmarks",
  title: "Bookmarks",
  path: "bookmarks",
  icon: "bookmark",
  mode: workbenchModes.project,
  main: { kind: "view", view: bookmarkTable.ref, cardinality: "one" },
  slots: [],
});

export const bookmarksNavigation = defineNavigationItem({
  id: "bookmarks",
  label: "Bookmarks",
  icon: "bookmark",
  owner: workbenchModes.project,
  action: { kind: "page", page: bookmarksPage.ref },
});
```

List the results in `defineExtension({ views, pages, navigationItems })`.

A view's `body.kind` chooses what it shows: `dataTable`, `kanban`, `controls`, `tree`, `file`, or `webview`, among others. Native views read their data in a `query` callback and run commands for their actions.

A view supplies content. A page owns an address and the panels on it. A mode owns the panels shared across its pages and the bars around the content, such as the sidebar. Most tools only need views and pages.

## Learn more

- [Write an extension](../extensions/0001-authoring.md#5-add-the-table) builds a table page step by step.
- [Workbench cookbook](../extensions/0002-workbench-cookbook.md#who-owns-what) has recipes for pages, inspectors, and shared panels.
- [Workbench composition](../../references/extensions/0008-contextual-workbench-composition.md) explains views, pages, and modes.
- [Contributions](../../references/extensions/0004-contribution-api.md) lists every view kind and table option.
- [Webviews and storage](../../references/extensions/0005-webview-and-storage-api.md) covers custom views.

*Updated at: 2026-11-22*
