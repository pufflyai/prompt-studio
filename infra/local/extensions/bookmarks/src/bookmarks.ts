import { type ExtensionStorageApi, eventRef } from "@pstdio/sdk/extensions";

export type Bookmark = { id: string; title: string; url: string; read: boolean };

// The extension ID is "<publisher>.<name>" from package.json.
export const bookmarksChanged = eventRef<{ ids: string[] }>({ extensionId: "acme.bookmarks", id: "changed" });

export const bookmarkStore = (storage: ExtensionStorageApi) => storage.collection<Bookmark>("bookmarks");

export async function setRead(storage: ExtensionStorageApi, id: string, read: boolean) {
  const store = bookmarkStore(storage);
  const bookmark = await store.get(id);
  if (!bookmark) throw new Error(`Bookmark not found: ${id}`);
  const updated = { ...bookmark, read };
  // update() only replaces an existing item. Unlike put(), it never brings back a deleted bookmark.
  await store.update(id, updated);
  return updated;
}
