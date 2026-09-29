import { expect, test } from "bun:test";
import { createNote } from "./notes";
import { createNotesMount } from "./test-mount";
import { notesTree } from "./tree";

test("lists notes from a local project workspace without repository context", async () => {
  const mount = createNotesMount();
  const note = await createNote(mount, "Folder notes");
  const groups = await notesTree.body.body({
    artifacts: { mount: () => mount },
    workspaces: {
      getDefault: async () => ({
        execution_kind: "local",
        provider_state: "ready",
        root_path: "/notes",
        provider_capabilities_json: { files: "write" },
      }),
    },
  } as never);
  expect(groups[0].nodes).toMatchObject([{ id: note.id, label: "Folder notes" }]);
  expect(groups[0].actions[0].disabled).toBe(false);
});

test("unavailable files do not load a note mount", async () => {
  const groups = await notesTree.body.body({
    artifacts: {
      mount: () => {
        throw new Error("Files unavailable");
      },
    },
    workspaces: {
      getDefault: async () => ({
        execution_kind: "local",
        provider_state: "ready",
        root_path: "/notes",
        provider_capabilities_json: { files: "none" },
      }),
    },
  } as never);
  expect(groups[0].nodes).toEqual([]);
  expect(groups[0].actions[0].disabled).toBe(true);
});

test("read-only files remain readable without offering note mutations", async () => {
  const mount = createNotesMount();
  const note = await createNote(mount, "Read-only note");
  const groups = await notesTree.body.body({
    artifacts: { mount: () => mount },
    workspaces: {
      getDefault: async () => ({
        execution_kind: "local",
        provider_state: "ready",
        root_path: "/notes",
        provider_capabilities_json: { files: "read" },
      }),
    },
  } as never);
  const tree = groups[0];
  expect(tree.nodes).toMatchObject([{ id: note.id }]);
  expect(tree.actions[0].disabled).toBe(true);
  expect(tree.nodes[0].contextMenuActions.every((action) => action.disabled)).toBe(true);
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
  expect(groups[0].nodes).toEqual([]);
  expect(groups[0].actions[0].disabled).toBe(true);
});

test.each([
  { provider_state: "provisioning" },
  { initializing: true },
  { setup_error: "Setup failed" },
])("unready workspace %j does not load a note mount", async (state) => {
  const groups = await notesTree.body.body({
    artifacts: {
      mount: () => {
        throw new Error("Workspace unavailable");
      },
    },
    workspaces: {
      getDefault: async () => ({
        execution_kind: "local",
        provider_state: "ready",
        root_path: "/notes",
        provider_capabilities_json: { files: "write" },
        ...state,
      }),
    },
  } as never);
  expect(groups[0].nodes).toEqual([]);
  expect(groups[0].actions[0].disabled).toBe(true);
});
