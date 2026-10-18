import { defineCommand, params } from "@pstdio/sdk/extensions";
import { type Bookmark, bookmarkStore, bookmarksChanged, setRead } from "./bookmarks";

export const bookmarkParams = {
  title: params.text({ label: "Title", required: true }),
  url: params.text({ label: "URL", required: true }),
};

export const addBookmark = defineCommand({
  id: "add",
  title: "Add bookmark",
  description: "Save a title and URL in this project's bookmarks.",
  cli: true,
  palette: [{ label: "Add bookmark" }],
  params: bookmarkParams,
  async run(ctx, { title, url }) {
    const bookmark: Bookmark = { id: crypto.randomUUID(), title, url, read: false };
    // Save first, then announce the change, so a refreshing view reads the new data.
    await bookmarkStore(ctx.storage).put(bookmark.id, bookmark);
    await ctx.events.emit(bookmarksChanged, { ids: [bookmark.id] });
    return bookmark;
  },
});

export const listBookmarks = defineCommand({
  id: "list",
  title: "List bookmarks",
  description: "Read this project's bookmarks. Use --unread to hide bookmarks you have read.",
  cli: true,
  params: {
    unread: params.boolean({ label: "Only unread" }),
  },
  async run(ctx, { unread }) {
    // list() returns a plain array of the stored values.
    const bookmarks = await bookmarkStore(ctx.storage).list();
    return unread ? bookmarks.filter((bookmark) => !bookmark.read) : bookmarks;
  },
});

export const toggleRead = defineCommand({
  id: "toggle-read",
  title: "Toggle read",
  description: "Mark a bookmark read, or unread if it was read.",
  cli: true,
  params: {
    // A table row action sends the clicked row's ID as rowId.
    rowId: params.text({ label: "Bookmark ID", required: true }),
  },
  async run(ctx, { rowId }) {
    const bookmark = await bookmarkStore(ctx.storage).get(rowId);
    if (!bookmark) throw new Error(`Bookmark not found: ${rowId}`);
    const updated = await setRead(ctx.storage, rowId, !bookmark.read);
    await ctx.events.emit(bookmarksChanged, { ids: [rowId] });
    return updated;
  },
});

export const deleteBookmarks = defineCommand({
  id: "delete",
  title: "Delete bookmarks",
  description: "Delete one or more bookmarks by ID.",
  cli: true,
  params: {
    // A table selection action sends the selected rows' IDs as rowIds.
    rowIds: params.list({ label: "Bookmark IDs", required: true }),
  },
  async run(ctx, { rowIds }) {
    const store = bookmarkStore(ctx.storage);
    for (const id of rowIds) await store.delete(id);
    await ctx.events.emit(bookmarksChanged, { ids: rowIds });
    return { deleted: rowIds };
  },
});
