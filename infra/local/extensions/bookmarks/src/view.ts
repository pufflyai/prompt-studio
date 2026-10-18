import { defineNavigationItem, definePage, defineView, workbenchModes } from "@pstdio/sdk/extensions";
import { bookmarkStore, bookmarksChanged, setRead } from "./bookmarks";
import { addBookmark, bookmarkParams, deleteBookmarks, toggleRead } from "./commands";

export const bookmarkTable = defineView({
  id: "bookmark-table",
  title: "Bookmarks",
  body: {
    kind: "dataTable",
    refreshEvents: [bookmarksChanged],
    columns: [
      { id: "title", label: "Title" },
      { id: "url", label: "URL" },
      { id: "read", label: "Read", type: "boolean" },
    ],
    defaultViews: [
      { id: "all", title: "All" },
      {
        id: "unread",
        title: "Unread",
        filter: { conjunction: "and", rules: [{ attributeId: "read", condition: "is", value: false }] },
      },
    ],
    defaultActiveViewId: "all",
    toolbarActions: [
      {
        id: "add",
        label: "Add bookmark",
        icon: "plus",
        presentation: "primary",
        command: addBookmark.ref,
        input: bookmarkParams,
        submitLabel: "Save",
      },
    ],
    rowActions: [{ id: "toggle-read", label: "Toggle read", icon: "check", command: toggleRead.ref }],
    selectionMode: "multiple",
    selectionActions: [
      { id: "delete", label: "Delete", icon: "trash-2", destructive: true, command: deleteBookmarks.ref },
    ],
    // Activating a row passes the whole row, not a rowId.
    async onRowActivate(ctx, { row }) {
      await setRead(ctx.storage, row.id, true);
      await ctx.events.emit(bookmarksChanged, { ids: [row.id] });
    },
    async query(ctx) {
      const bookmarks = await bookmarkStore(ctx.storage).list();
      return {
        rows: bookmarks.map(({ id, title, url, read }) => ({ id, values: { title, url, read } })),
      };
    },
  },
});

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
