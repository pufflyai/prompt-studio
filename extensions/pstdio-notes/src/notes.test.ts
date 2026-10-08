import { describe, expect, test } from "bun:test";
import { createNote, deleteNote, listNotes, noteExists, readNote, renameNote, writeNote } from "./notes";
import { createNotesMount } from "./test-mount";

describe("notes", () => {
  test("creates a new note without asking for a title", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount);
    expect(note.title).toBe("New note");
    expect(await readNote(mount, note.id)).toBe("");
    expect(await listNotes(mount)).toMatchObject([{ id: note.id, title: "New note" }]);
  });

  test("saves the first content title and preserves it across later edits", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount);
    await writeNote(mount, note.id, "\n# Meeting notes\n\nAgenda");
    expect(await listNotes(mount)).toMatchObject([{ id: note.id, title: "Meeting notes" }]);
    await writeNote(mount, note.id, "Updated opening\n\nMore content");
    expect(await listNotes(mount)).toMatchObject([{ title: "Meeting notes" }]);
    await renameNote(mount, note.id, "My title");
    await writeNote(mount, note.id, "A different opening");
    expect(await listNotes(mount)).toMatchObject([{ title: "My title" }]);
  });

  test("keeps the saved title when note content is cleared", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount);
    await writeNote(mount, note.id, "First line");
    await writeNote(mount, note.id, " \n ");
    expect(await listNotes(mount)).toMatchObject([{ title: "First line" }]);
  });

  test("respects an explicit New note title", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount);
    await renameNote(mount, note.id, "New note");
    await writeNote(mount, note.id, "Content should not rename this note");
    expect(await listNotes(mount)).toMatchObject([{ title: "New note" }]);
  });

  test("stores the title in Markdown front matter and honors file edits", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount, "Saved title");
    expect(await mount.readText(`${note.id}/content.md`)).toContain('title: "Saved title"');
    await mount.updateText(`${note.id}/content.md`, '---\ntitle: "From the file"\ntags: [ideas]\n---\n\n# Body');
    expect(await listNotes(mount)).toMatchObject([{ title: "From the file" }]);
    await renameNote(mount, note.id, "Renamed");
    expect(await mount.readText(`${note.id}/content.md`)).toContain("tags: [ideas]");
    expect(await readNote(mount, note.id)).toBe("# Body");
  });

  test("preserves old sidecar titles when moving them into Markdown front matter", async () => {
    const mount = createNotesMount();
    await mount.writeText("existing/title.txt", "Existing title");
    await mount.writeText("existing/content.md", "Original body");
    await writeNote(mount, "existing", "Updated body");
    expect(await listNotes(mount)).toMatchObject([{ title: "Existing title" }]);
    expect(await readNote(mount, "existing")).toBe("Updated body");
    expect(await mount.readText("existing/content.md")).toContain('title: "Existing title"');
    expect(await mount.exists("existing/title.txt")).toBe(false);
  });

  test("rejects blank titles without creating a document", async () => {
    const mount = createNotesMount();
    await expect(createNote(mount, " \t\n ")).rejects.toThrow("title");
    expect(mount.files.size).toBe(0);
  });

  test("preserves notes created concurrently with the same title", async () => {
    const mount = createNotesMount();
    const notes = await Promise.all([createNote(mount, "Ideas"), createNote(mount, "Ideas")]);
    expect(new Set(notes.map((note) => note.id)).size).toBe(2);
    expect(await listNotes(mount)).toHaveLength(2);
    for (const note of notes) expect(await readNote(mount, note.id)).toBe("");
  });

  test("keeps titles independent of headings and empty content", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount, "My title");
    for (const content of ["# Different heading\n\nBody", "No headings", ""]) {
      await writeNote(mount, note.id, content);
      expect(await listNotes(mount)).toMatchObject([{ id: note.id, title: "My title" }]);
    }
  });

  test("renames a note without changing its identity or Markdown", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount, "First title");
    const content = "# A heading\n\n- Keep this **body**\n";
    await writeNote(mount, note.id, content);
    expect(await renameNote(mount, note.id, "  New title  ")).toEqual({ id: note.id, title: "New title" });
    expect(await readNote(mount, note.id)).toBe(content);
    expect(await listNotes(mount)).toMatchObject([{ id: note.id, title: "New title" }]);
  });

  test("rejects a blank rename without changing the note", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount, "Keep title");
    await expect(renameNote(mount, note.id, " \t\n ")).rejects.toThrow("title");
    expect(await listNotes(mount)).toMatchObject([{ id: note.id, title: "Keep title" }]);
  });

  test("preserves both a rename and a concurrent body save", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount, "First title");
    await Promise.all([renameNote(mount, note.id, "New title"), writeNote(mount, note.id, "# New body")]);
    expect(await readNote(mount, note.id)).toBe("# New body");
    expect(await listNotes(mount)).toMatchObject([{ id: note.id, title: "New title" }]);
  });

  test("skips a note deleted after listing while preserving the remaining notes", async () => {
    const mount = createNotesMount();
    const keep = await createNote(mount, "Keep");
    const drop = await createNote(mount, "Drop");
    const readText = mount.readText;
    mount.readText = async (path) => {
      if (path.startsWith(`${drop.id}/`)) await deleteNote(mount, drop.id);
      return readText(path);
    };
    expect(await listNotes(mount)).toMatchObject([{ id: keep.id, title: "Keep" }]);
  });

  test("reports title read failures for notes that still exist", async () => {
    const mount = createNotesMount();
    await createNote(mount, "Unreadable");
    mount.readText = async () => {
      throw new Error("Permission denied");
    };
    await expect(listNotes(mount)).rejects.toThrow("Permission denied");
  });

  test("lists notes with their saved titles, most recently edited first", async () => {
    const mount = createNotesMount();
    const first = await createNote(mount, "First");
    const second = await createNote(mount, "Second");
    await writeNote(mount, first.id, "# A body heading\n\nBody\n");
    expect(await listNotes(mount)).toMatchObject([
      { id: first.id, title: "First" },
      { id: second.id, title: "Second" },
    ]);
  });

  test("keeps Markdown source intact across saves and reloads", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount, "Notes");
    const content = "# Notes\n\n- [ ] Try **bold** and `code`\n\n| A | B |\n| - | - |\n| 1 | 2 |\n";
    await writeNote(mount, note.id, content);
    expect(await readNote(mount, note.id)).toBe(content);
  });

  test("deletes the body and title and rejects delayed saves and renames", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount, "Drop");
    await deleteNote(mount, note.id);
    await expect(writeNote(mount, note.id, "Restored?")).rejects.toThrow();
    await expect(renameNote(mount, note.id, "Restored?")).rejects.toThrow();
    expect(await listNotes(mount)).toEqual([]);
    expect(await noteExists(mount, note.id)).toBe(false);
    expect(mount.files.size).toBe(0);
  });

  test("keeps title characters out of document paths", async () => {
    const mount = createNotesMount();
    const note = await createNote(mount, "../../escape attempt");
    expect(note.id).not.toMatch(/[./\\]/);
    expect(await listNotes(mount)).toMatchObject([{ title: "../../escape attempt" }]);
  });
});
