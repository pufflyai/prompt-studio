import { describe, expect, test } from "bun:test";
import { createNote, deleteNote, listNotes, renameNote } from "./notes";
import { editor, notesPage } from "./pages";
import { createNotesMount } from "./test-mount";

const createContext = () => {
  const mount = createNotesMount();
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
  test("opens a new note with an empty body", async () => {
    const { ctx, mount } = createContext();
    const note = await createNote(mount, "Release checklist");
    expect(await load(ctx, note.id)).toMatchObject({ mimeType: "text/markdown", content: "" });
  });

  test("asks for a note when the page has none open", async () => {
    const { ctx } = createContext();
    expect(await load(ctx)).toMatchObject({ emptyState: { title: "No note open" } });
  });

  test("keeps Markdown source intact across saves and reloads without changing the title", async () => {
    const { ctx, mount } = createContext();
    const note = await createNote(mount, "My title");
    const content = "# A different heading\n\n- [ ] Try **bold** and `code`\n";
    await save(ctx, note.id, content);
    expect(await load(ctx, note.id)).toMatchObject({ content });
    expect(await listNotes(mount)).toMatchObject([{ id: note.id, title: "My title" }]);
  });

  test("loads the current title for an open tab after a rename", async () => {
    const { ctx, mount } = createContext();
    const note = await createNote(mount, "Original");
    await renameNote(mount, note.id, "Renamed");
    const query = notesPage.slots[0].tab.query;
    expect(
      await query(ctx as never, {
        renderer: { rendererId: "notes", resource: { type: "note", id: note.id, label: "Original" } },
      }),
    ).toEqual({ label: "Renamed" });
  });

  test("does not bring back a note that was deleted while its tab stayed open", async () => {
    const { ctx, mount } = createContext();
    const note = await createNote(mount, "Dropped");
    await deleteNote(mount, note.id);
    await expect(save(ctx, note.id, "# Dropped\n\nrestored?\n")).rejects.toThrow();
    expect(await listNotes(mount)).toEqual([]);
    expect(await load(ctx, note.id)).toMatchObject({ emptyState: { title: "Note not found" } });
  });
});
