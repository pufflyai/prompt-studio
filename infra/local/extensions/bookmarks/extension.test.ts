import { describe, expect, test } from "bun:test";
import { EXTENSION_API_VERSION, type ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import type { Bookmark } from "./src/bookmarks";
import { addBookmark, deleteBookmarks, listBookmarks, toggleRead } from "./src/commands";
import { bookmarkTable } from "./src/view";

// Each event records the bookmarks that were saved when it was emitted.
const project = () => {
  const storage = createMemoryStorage();
  const events: { ids: string[]; saved: Bookmark[] }[] = [];
  const emit = async (_event: unknown, payload: { ids: string[] }) => {
    events.push({ ids: payload.ids, saved: await storage.collection<Bookmark>("bookmarks").list() });
    return { delivered: 1 };
  };
  const args = <TParams extends Record<string, unknown>>(params: TParams) =>
    makeCommandArgs({ storage, params, overrides: { events: { emit } as never } });
  return { storage, events, args };
};

const renderer = { rendererId: "acme.bookmarks.bookmark-table" };
const tableQuery = (storage: ExtensionStorageApi) => bookmarkTable.body.query({ storage } as never);

describe("bookmarks example", () => {
  test("type checks and runs against the SDK release the authoring guide targets", () => {
    expect(EXTENSION_API_VERSION).toBe("0.1.6");
  });

  test("adds a bookmark and saves it before announcing the change", async () => {
    const { events, args } = project();

    const saved = await addBookmark.run(...args({ title: "Prompt Studio", url: "https://prompt.studio" }));

    expect(saved).toMatchObject({ title: "Prompt Studio", url: "https://prompt.studio", read: false });
    expect(await listBookmarks.run(...args({}))).toEqual([saved]);
    expect(events).toEqual([{ ids: [saved.id], saved: [saved] }]);
  });

  test("toggles read state and filters unread bookmarks", async () => {
    const { args } = project();
    const first = await addBookmark.run(...args({ title: "First", url: "https://example.com/1" }));
    const second = await addBookmark.run(...args({ title: "Second", url: "https://example.com/2" }));

    expect(await toggleRead.run(...args({ rowId: first.id }))).toMatchObject({ id: first.id, read: true });

    expect(await listBookmarks.run(...args({ unread: true }))).toEqual([second]);
    expect(await toggleRead.run(...args({ rowId: first.id }))).toMatchObject({ read: false });
  });

  test("refuses to update a bookmark that was deleted", async () => {
    const { storage, args } = project();
    const bookmark = await addBookmark.run(...args({ title: "Gone", url: "https://example.com" }));
    await storage.collection("bookmarks").delete(bookmark.id);

    await expect(toggleRead.run(...args({ rowId: bookmark.id }))).rejects.toThrow("Bookmark not found");
    expect(await listBookmarks.run(...args({}))).toEqual([]);
  });

  test("deletes every selected bookmark", async () => {
    const { events, args } = project();
    const kept = await addBookmark.run(...args({ title: "Kept", url: "https://example.com/kept" }));
    const first = await addBookmark.run(...args({ title: "First", url: "https://example.com/1" }));
    const second = await addBookmark.run(...args({ title: "Second", url: "https://example.com/2" }));

    expect(await deleteBookmarks.run(...args({ rowIds: [first.id, second.id] }))).toEqual({
      deleted: [first.id, second.id],
    });

    expect(await listBookmarks.run(...args({}))).toEqual([kept]);
    expect(events.at(-1)).toEqual({ ids: [first.id, second.id], saved: [kept] });
  });

  test("shows saved bookmarks as table rows and marks an activated row read", async () => {
    const { storage, events, args } = project();
    const bookmark = await addBookmark.run(...args({ title: "Docs", url: "https://prompt.studio/docs/" }));
    const [ctx] = args({});
    const [row] = (await tableQuery(storage)).rows;

    expect(row).toEqual({
      id: bookmark.id,
      values: { title: "Docs", url: "https://prompt.studio/docs/", read: false },
    });

    await bookmarkTable.body.onRowActivate?.(ctx, { row, renderer });

    expect((await tableQuery(storage)).rows[0]?.values.read).toBe(true);
    expect(events.at(-1)).toEqual({ ids: [bookmark.id], saved: [{ ...bookmark, read: true }] });
  });

  test("keeps bookmarks in the storage of the project that saved them", async () => {
    const first = project();
    const second = project();

    const saved = await addBookmark.run(...first.args({ title: "Only here", url: "https://example.com" }));

    expect(await listBookmarks.run(...first.args({}))).toEqual([saved]);
    expect(await listBookmarks.run(...second.args({}))).toEqual([]);
  });
});
