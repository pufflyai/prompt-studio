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
  test("preserves notes created concurrently with the same title", async () => {
    const mount = createMount();
    const notes = await Promise.all([createNote(mount, "Ideas"), createNote(mount, "Ideas")]);

    expect(new Set(notes.map((note) => note.id)).size).toBe(2);
    expect(await listNotes(mount)).toHaveLength(2);
    for (const note of notes) expect(await readNote(mount, note.id)).toBe("# Ideas\n\n");
  });

  test("uses the first Markdown heading and falls back to the id without a heading", async () => {
    const mount = createMount();
    await mount.writeText("heading.md", "Opening paragraph\n\n## Heading after the introduction\n\n# Later heading");
    await mount.writeText("paragraph.md", "Opening paragraph\n\nStill no heading.");

    expect(await listNotes(mount)).toMatchObject([
      { id: "paragraph", title: "paragraph" },
      { id: "heading", title: "Heading after the introduction" },
    ]);
  });

  test("skips a note deleted after listing while preserving the remaining notes", async () => {
    const mount = createMount();
    await mount.writeText("keep.md", "# Keep");
    await mount.writeText("drop.md", "# Drop");
    const readText = mount.readText;
    mount.readText = async (path) => {
      if (path === "drop.md") await mount.delete(path);
      return readText(path);
    };

    expect(await listNotes(mount)).toMatchObject([{ id: "keep", title: "Keep" }]);
    await expect(createNote(mount, "Unrelated")).resolves.toMatchObject({ title: "Unrelated" });
  });

  test("reports read failures for notes that still exist", async () => {
    const mount = createMount();
    await mount.writeText("unreadable.md", "# Unreadable");
    mount.readText = async () => {
      throw new Error("Permission denied");
    };

    await expect(listNotes(mount)).rejects.toThrow("Permission denied");
  });

  test("creates a Markdown document per note and titles it with a heading", async () => {
    const mount = createMount();

    const note = await createNote(mount, "Release checklist");

    expect(note).toEqual({ id: expect.stringMatching(/^release-checklist-/), title: "Release checklist" });
    expect(await readNote(mount, note.id)).toBe("# Release checklist\n\n");
    expect([...mount.files.keys()]).toEqual([`${note.id}.md`]);
  });

  test("keeps documents apart when two notes share a title", async () => {
    const mount = createMount();

    const first = await createNote(mount, "Ideas");
    const second = await createNote(mount, "Ideas");

    expect(first.id).not.toBe(second.id);
    expect([first.title, second.title]).toEqual(["Ideas", "Ideas"]);
  });

  test("lists every note with its current heading, most recently edited first", async () => {
    const mount = createMount();
    const first = await createNote(mount, "First");
    const second = await createNote(mount, "Second");
    await writeNote(mount, first.id, "# Renamed first\n\nBody\n");

    expect(await listNotes(mount)).toMatchObject([
      { id: first.id, title: "Renamed first" },
      { id: second.id, title: "Second" },
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
    const keep = await createNote(mount, "Keep");
    const dropped = await createNote(mount, "Drop");

    await deleteNote(mount, dropped.id);

    expect(await listNotes(mount)).toMatchObject([{ id: keep.id }]);
    expect(await noteExists(mount, dropped.id)).toBe(false);
  });

  test("names documents after the note title without path separators", async () => {
    const mount = createMount();

    const note = await createNote(mount, "../../escape attempt");

    expect(note.id).toStartWith("escape-attempt-");
    expect(note.id).not.toMatch(/[./\\]/);
  });
});
