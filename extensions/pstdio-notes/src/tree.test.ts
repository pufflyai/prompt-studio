import { expect, test } from "bun:test";
import { createNote } from "./notes";
import { createNotesMount } from "./test-mount";
import { notesTree } from "./tree";

test("lists notes from a local project workspace without repository context", async () => {
  const mount = createNotesMount();
  const note = await createNote(mount, "Folder notes");
  const groups = await notesTree.body.body({
    artifacts: { mount: () => mount },
    workspaces: { getDefault: async () => ({ execution_kind: "local", root_path: "/notes" }) },
  } as never);
  expect(groups[0].nodes[0].children).toMatchObject([{ id: note.id, label: "Folder notes" }]);
  expect(groups[0].nodes[0].actions[0].disabled).toBe(false);
});

test("remote-only projects do not read local note files", async () => {
  const groups = await notesTree.body.body({
    artifacts: {
      mount: () => {
        throw new Error("No local target");
      },
    },
    workspaces: { getDefault: async () => ({ execution_kind: "remote", root_path: null }) },
  } as never);
  expect(groups[0].nodes[0].children).toEqual([]);
  expect(groups[0].nodes[0].actions[0].disabled).toBe(true);
});
