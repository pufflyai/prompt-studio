import { expect, test } from "bun:test";
import extension from "../extension";
import { createNote, deleteNote, readNote, readNoteTitle, renameNote } from "./notes";
import { editor } from "./pages";
import { createNotesMount } from "./test-mount";

const fixture = (files = "write") => {
  const mount = createNotesMount();
  const events: unknown[] = [];
  const ctx = {
    artifacts: { mount: () => mount },
    events: {
      emit: async (...event: unknown[]) => {
        events.push(event);
      },
    },
    workspaces: {
      getDefault: async () => ({
        execution_kind: "local",
        provider_state: "ready",
        root_path: "/notes",
        provider_capabilities_json: { files },
      }),
    },
  };
  return { mount, ctx, events };
};
const provider = () => {
  const source = extension.textSources?.find(({ id }) => id === "note");
  expect(source).toBeDefined();
  return source!;
};

test("a note selects its public source and projects complete Markdown without rewriting front matter", async () => {
  const { mount, ctx, events } = fixture();
  const original = "---\r\ntitle: 'Kept title'\r\ncustom: [one, two] # retain this\r\n---\r\n\r\nOld body";
  await mount.writeText("selected/content.md", original);
  const loaded = await editor.body.load(
    ctx as never,
    { renderer: { rendererId: "notes", resource: { type: "note", id: "selected" } } } as never,
  );
  expect(loaded).toMatchObject({ textDocument: { sourceId: "note", params: { noteId: "selected" } } });
  const source = provider();
  expect(await source.resolve(ctx as never, { params: { noteId: "selected" } })).toEqual({
    source: { kind: "artifact", mount: "documents", path: "selected/content.md", identity: "selected" },
    content: original,
    editable: true,
  });
  const changed = original.replace("Old body", "# New body\n\nPeer text");
  await source.project(ctx as never, { params: { noteId: "selected" }, content: changed });
  expect(await mount.readText("selected/content.md")).toBe(changed);
  expect(await readNoteTitle(mount, "selected")).toBe("Kept title");
  expect(events).toHaveLength(1);
  await renameNote(mount, "selected", "Renamed");
  expect((await source.resolve(ctx as never, { params: { noteId: "selected" } })).source).toEqual({
    kind: "artifact",
    mount: "documents",
    path: "selected/content.md",
    identity: "selected",
  });
});

test("public note projection derives the first title and never recreates a removed source", async () => {
  const { mount, ctx } = fixture();
  await createNote(mount, "selected");
  const source = provider();
  const current = await source.resolve(ctx as never, { params: { noteId: "selected" } });
  await source.project(ctx as never, {
    params: { noteId: "selected" },
    content: `${current.content}\n\n# First heading\n\nBody`,
  });
  expect(await readNoteTitle(mount, "selected")).toBe("First heading");
  expect(await readNote(mount, "selected")).toBe("# First heading\n\nBody");
  await deleteNote(mount, "selected");
  await expect(
    source.project(ctx as never, { params: { noteId: "selected" }, content: "Restored?" }),
  ).rejects.toThrow();
  expect(await mount.exists("selected/content.md")).toBe(false);
});

test("public note projection checks current workspace write access", async () => {
  const { mount, ctx, events } = fixture("read");
  await createNote(mount, "selected", "Readonly");
  const source = provider();
  expect(await source.resolve(ctx as never, { params: { noteId: "selected" } })).toMatchObject({ editable: false });
  await expect(source.project(ctx as never, { params: { noteId: "selected" }, content: "Denied" })).rejects.toThrow();
  expect(await readNote(mount, "selected")).toBe("");
  expect(events).toHaveLength(0);
});
