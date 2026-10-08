import { expect, test } from "bun:test";
import { createNote, renameNote, writeNote } from "./notes";
import { noteResources } from "./resources";
import { createNotesMount } from "./test-mount";

test("searches existing notes by title and content and opens their resource panel", async () => {
  const mount = createNotesMount();
  const note = await createNote(mount);
  await writeNote(mount, note.id, "# Research plan\nDiscuss sidebar accessibility");
  const ctx = {
    artifacts: { mount: () => mount },
    workspaces: {
      getDefault: async () => ({
        execution_kind: "local",
        provider_state: "ready",
        root_path: "/notes",
        provider_capabilities_json: { files: "write" },
      }),
    },
  } as never;
  const query = { query: "ACCESSIBILITY", limit: 10 } as never;
  expect(await noteResources.query(ctx, query)).toMatchObject({
    items: [
      {
        id: note.id,
        label: "Research plan",
        target: {
          kind: "compound",
          targets: [{ kind: "page" }, { kind: "panel", resource: { type: "note", id: note.id } }],
        },
      },
    ],
  });
  await renameNote(mount, note.id, "Team decisions");
  expect(await noteResources.query(ctx, { query: "team", limit: 1 } as never)).toMatchObject({
    items: [{ label: "Team decisions" }],
  });
  await mount.delete(note.id);
  expect(await noteResources.query(ctx, query)).toEqual({ items: [] });
});
