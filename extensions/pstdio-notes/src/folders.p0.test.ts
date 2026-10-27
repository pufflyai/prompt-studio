import { expect, test } from "bun:test";
import { createMemoryStorage as createIdStorage } from "@pstdio/sdk/testing";
import { createFolder, deleteFolder, listFolders, moveNote, renameFolder } from "./folders";
import { createNote, listNotes, readNote, writeNote } from "./notes";
import { createNotesMount } from "./test-mount";

const coreIds = createIdStorage().ids;

test("moves notes into a folder without changing their identity or content", async () => {
  const mount = createNotesMount();
  const folder = await createFolder(mount, coreIds.create(), "Research");
  const note = await createNote(mount, coreIds.create(), "Reading list");
  await writeNote(mount, note.id, "Keep this content");
  await moveNote(mount, note.id, folder.id);
  expect(await listFolders(mount)).toEqual([folder]);
  expect(await listNotes(mount)).toMatchObject([{ id: note.id, title: note.title, folderId: folder.id }]);
  expect(await readNote(mount, note.id)).toBe("Keep this content");
  await moveNote(mount, note.id);
  expect((await listNotes(mount))[0].folderId).toBeUndefined();
});

test("renames folders and preserves their notes when a folder is removed", async () => {
  const mount = createNotesMount();
  const folder = await createFolder(mount, coreIds.create(), "Ideas");
  const note = await createNote(mount, coreIds.create());
  await moveNote(mount, note.id, folder.id);
  await renameFolder(mount, folder.id, "Collected ideas");
  expect(await listFolders(mount)).toEqual([{ id: folder.id, title: "Collected ideas" }]);
  await deleteFolder(mount, folder.id);
  expect(await listFolders(mount)).toEqual([]);
  expect(await listNotes(mount)).toMatchObject([{ id: note.id, title: "New note" }]);
  expect((await listNotes(mount))[0].folderId).toBeUndefined();
});

test("rejects missing folders and blank folder names without moving a note", async () => {
  const mount = createNotesMount();
  const note = await createNote(mount, coreIds.create());
  await expect(createFolder(mount, coreIds.create(), " \n ")).rejects.toThrow("name");
  await expect(moveNote(mount, note.id, "missing")).rejects.toThrow("Folder not found");
  expect((await listNotes(mount))[0].folderId).toBeUndefined();
});

test("rejects duplicate folder names on creation and rename, ignoring case and surrounding space", async () => {
  const mount = createNotesMount();
  const first = await createFolder(mount, coreIds.create(), "Research");
  await expect(createFolder(mount, coreIds.create(), " research ")).rejects.toThrow("already exists");
  const second = await createFolder(mount, coreIds.create(), "Ideas");
  await expect(renameFolder(mount, second.id, "RESEARCH")).rejects.toThrow("already exists");
  await renameFolder(mount, first.id, "RESEARCH");
  expect(await listFolders(mount)).toEqual([
    { id: second.id, title: "Ideas" },
    { id: first.id, title: "RESEARCH" },
  ]);
});
