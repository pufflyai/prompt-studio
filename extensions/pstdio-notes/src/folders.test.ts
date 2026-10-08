import { expect, test } from "bun:test";
import { createFolder, deleteFolder, listFolders, moveNote, renameFolder } from "./folders";
import { createNote, listNotes, readNote, writeNote } from "./notes";
import { createNotesMount } from "./test-mount";

test("moves notes into a folder without changing their identity or content", async () => {
  const mount = createNotesMount();
  const folder = await createFolder(mount, "Research");
  const note = await createNote(mount, "Reading list");
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
  const folder = await createFolder(mount, "Ideas");
  const note = await createNote(mount);
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
  const note = await createNote(mount);
  await expect(createFolder(mount, " \n ")).rejects.toThrow("name");
  await expect(moveNote(mount, note.id, "missing")).rejects.toThrow("Folder not found");
  expect((await listNotes(mount))[0].folderId).toBeUndefined();
});
