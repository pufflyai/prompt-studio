import { describe, expect, test } from "bun:test";
import { createNote, deleteNote, listNotes, noteExists, readNote, writeNote } from "./notes";

const createMount = () => {
  const files = new Map<string, { content: string; updatedAt: string }>();
  let clock = 0;
  return {
    files,
    exists: async (path: string) => files.has(path),
    list: async (pattern?: string) =>
      [...files.entries()]
        .filter(([path]) => !pattern || path.endsWith(pattern.replace("*", "")))
        .map(([path, file]) => ({ path, updatedAt: file.updatedAt }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    readText: async (path: string) => {
      const file = files.get(path);
      if (!file) throw new Error(`Not found: ${path}`);
      return file.content;
    },
    writeText: async (path: string, content: string) => {
      clock += 1;
      files.set(path, { content, updatedAt: new Date(clock * 1000).toISOString() });
    },
    updateText: async (path: string, content: string) => {
      if (!files.has(path)) throw new Error(`Not found: ${path}`);
      clock += 1;
      files.set(path, { content, updatedAt: new Date(clock * 1000).toISOString() });
    },
    delete: async (path: string) => {
      files.delete(path);
    },
  };
};

describe("notes", () => {
  test("creates a Markdown document per note and titles it with a heading", async () => {
    const mount = createMount();

    const note = await createNote(mount, "Release checklist");

    expect(note).toEqual({ id: "release-checklist", title: "Release checklist" });
    expect(await readNote(mount, note.id)).toBe("# Release checklist\n\n");
    expect([...mount.files.keys()]).toEqual(["release-checklist.md"]);
  });

  test("keeps documents apart when two notes share a title", async () => {
    const mount = createMount();

    const first = await createNote(mount, "Ideas");
    const second = await createNote(mount, "Ideas");

    expect([first.id, second.id]).toEqual(["ideas", "ideas-2"]);
  });

  test("lists every note with its current heading, most recently edited first", async () => {
    const mount = createMount();
    await createNote(mount, "First");
    await createNote(mount, "Second");
    await writeNote(mount, "first", "# Renamed first\n\nBody\n");

    expect(await listNotes(mount)).toMatchObject([
      { id: "first", title: "Renamed first" },
      { id: "second", title: "Second" },
    ]);
  });

  test("keeps Markdown source intact across saves and reloads", async () => {
    const mount = createMount();
    const note = await createNote(mount, "Notes");
    const content = "# Notes\n\n- [ ] Try **bold** and `code`\n\n| A | B |\n| - | - |\n| 1 | 2 |\n";

    await writeNote(mount, note.id, content);

    expect(await readNote(mount, note.id)).toBe(content);
  });

  test("removes a deleted note from the list", async () => {
    const mount = createMount();
    await createNote(mount, "Keep");
    const dropped = await createNote(mount, "Drop");

    await deleteNote(mount, dropped.id);

    expect(await listNotes(mount)).toMatchObject([{ id: "keep" }]);
    expect(await noteExists(mount, dropped.id)).toBe(false);
  });

  test("names documents after the note title without path separators", async () => {
    const mount = createMount();

    const note = await createNote(mount, "../../escape attempt");

    expect(note.id).toBe("escape-attempt");
  });
});
