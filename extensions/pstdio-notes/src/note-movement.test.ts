import { expect, test } from "bun:test";
import { createFolder } from "./folders";
import { moveTreeNote } from "./note-movement";
import { createNote, listNotes, writeNote } from "./notes";
import { createNotesMount } from "./test-mount";

test("reorders notes and preserves order through content edits and folder moves", async () => {
  const mount = createNotesMount();
  const first = await createNote(mount, "First");
  const second = await createNote(mount, "Second");
  const folder = await createFolder(mount, "Ideas");
  await moveTreeNote(mount, first.id, second.id, "before");
  await writeNote(mount, second.id, "Edited content");
  expect((await listNotes(mount)).map((note) => note.id)).toEqual([first.id, second.id]);
  await moveTreeNote(mount, first.id, `folder:${folder.id}`, "inside");
  expect((await listNotes(mount)).find((note) => note.id === first.id)?.folderId).toBe(folder.id);
  await moveTreeNote(mount, first.id, "notes", "inside");
  expect((await listNotes(mount)).find((note) => note.id === first.id)?.folderId).toBeUndefined();
});

test("rejects drop targets outside Notes without changing the note", async () => {
  const mount = createNotesMount();
  const note = await createNote(mount);
  await expect(moveTreeNote(mount, note.id, "workspaces", "inside")).rejects.toThrow("Note not found");
  expect((await listNotes(mount))[0].folderId).toBeUndefined();
});

test("moves notes both before and after another note", async () => {
  const mount = createNotesMount();
  const first = await createNote(mount, "First");
  const second = await createNote(mount, "Second");
  await moveTreeNote(mount, first.id, second.id, "after");
  expect((await listNotes(mount)).map((note) => note.id)).toEqual([second.id, first.id]);
  await moveTreeNote(mount, first.id, second.id, "before");
  expect((await listNotes(mount)).map((note) => note.id)).toEqual([first.id, second.id]);
});
