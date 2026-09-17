import { describe, expect, test } from "bun:test";
import { createNote, listNotes } from "./notes";
import { editor } from "./pages";

const createContext = () => {
  const files = new Map<string, string>();
  const mount = {
    exists: async (path: string) => files.has(path),
    list: async () => [...files.keys()].map((path) => ({ path })),
    readText: async (path: string) => files.get(path) ?? "",
    writeText: async (path: string, content: string) => {
      files.set(path, content);
    },
    updateText: async (path: string, content: string) => {
      if (!files.has(path)) throw new Error(`Not found: ${path}`);
      files.set(path, content);
    },
    delete: async (path: string) => {
      files.delete(path);
    },
  };
  return { mount, ctx: { artifacts: { mount: () => mount }, events: { emit: async () => undefined } } };
};

const load = (ctx: unknown, id?: string) =>
  editor.body.load(
    ctx as never,
    { renderer: { rendererId: "notes", ...(id ? { resource: { type: "note", id } } : {}) } } as never,
  );

const save = (ctx: unknown, id: string, content: string) =>
  editor.body.save?.(
    ctx as never,
    { renderer: { rendererId: "notes", resource: { type: "note", id } }, content } as never,
  );

describe("note editor", () => {
  test("opens the Markdown document of the routed note", async () => {
    const { ctx, mount } = createContext();
    const note = await createNote(mount, "Release checklist");

    expect(await load(ctx, note.id)).toMatchObject({
      fileName: "release-checklist.md",
      mimeType: "text/markdown",
      content: "# Release checklist\n\n",
    });
  });

  test("asks for a note when the page has none open", async () => {
    const { ctx } = createContext();

    expect(await load(ctx)).toMatchObject({ emptyState: { title: "No note open" } });
  });

  test("keeps Markdown source intact across saves and reloads", async () => {
    const { ctx, mount } = createContext();
    const note = await createNote(mount, "Notes");
    const content = "# Notes\n\n- [ ] Try **bold** and `code`\n\n| A | B |\n| - | - |\n| 1 | 2 |\n";

    await save(ctx, note.id, content);

    expect(await load(ctx, note.id)).toMatchObject({ content });
  });

  test("does not bring back a note that was deleted while its tab stayed open", async () => {
    const { ctx, mount } = createContext();
    const note = await createNote(mount, "Dropped");
    await mount.delete("dropped.md");

    await expect(save(ctx, note.id, "# Dropped\n\nrestored?\n")).rejects.toThrow();

    expect(await listNotes(mount)).toEqual([]);
    expect(await load(ctx, note.id)).toMatchObject({ emptyState: { title: "Note not found" } });
  });
});
