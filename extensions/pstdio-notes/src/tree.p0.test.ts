import { expect, test } from "bun:test";
import { createMemoryStorage as createIdStorage } from "@pstdio/sdk/testing";
import { createFolder, moveNote } from "./folders";
import { createNote } from "./notes";
import { createNotesMount } from "./test-mount";
import { notesTree } from "./tree";

const coreIds = createIdStorage().ids;

test("builds notes and folders from one listing without probing missing sidecars", async () => {
  const mount = createNotesMount();
  const folder = await createFolder(mount, "ideas", "Ideas");
  await mount.writeText("older/content.md", "Legacy body");
  await mount.writeText("older/title.txt", "Older note");
  await moveNote(mount, "older", folder.id);
  await createNote(mount, "newer", "Loose note");
  await mount.writeText(".order.json", JSON.stringify(["older", "newer"]));
  let lists = 0;
  const groups = await notesTree.body.body({
    artifacts: {
      mount: () => ({
        ...mount,
        list: (pattern?: string) => {
          lists++;
          return mount.list(pattern);
        },
        exists: (path: string) => {
          throw new Error(`Unexpected file existence check: ${path}`);
        },
      }),
    },
    workspaces: {
      getDefault: async () => ({
        execution_kind: "local",
        provider_state: "ready",
        root_path: "/notes",
        provider_capabilities_json: { files: "write" },
      }),
    },
  } as never);
  expect(lists).toBe(1);
  const children = groups[0].nodes[0].children;
  expect(children.find((row) => row.id === `folder:${folder.id}`)).toMatchObject({
    label: "Ideas",
    children: [{ id: "older", label: "Older note" }],
  });
  expect(children.find((row) => row.id === "newer")).toMatchObject({ label: "Loose note" });
});

test("lists notes from a local project workspace without repository context", async () => {
  const mount = createNotesMount();
  const note = await createNote(mount, coreIds.create(), "Folder notes");
  const groups = await notesTree.body.body({
    extensionId: "pstdio.notes",
    projectId: "notes-project",
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
  expect(groups[0].nodes[0].children).toMatchObject([
    {
      id: note.id,
      label: "Folder notes",
      resource: { type: "note", id: note.id, extensionId: "pstdio.notes", projectId: "notes-project" },
    },
  ]);
  expect(groups[0].nodes[0].actions[0].disabled).toBe(false);
  const opened = groups[0].nodes[0].children[0];
  if (!("target" in opened)) throw new Error("Expected a note navigation target");
  expect(opened.target.resource).toEqual(opened.resource);
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
  expect(groups[0].nodes[0].children).toEqual([]);
  expect(groups[0].nodes[0].actions[0].disabled).toBe(true);
});

test("read-only files remain readable without offering note mutations", async () => {
  const mount = createNotesMount();
  const note = await createNote(mount, coreIds.create(), "Read-only note");
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
  const tree = groups[0].nodes[0];
  expect(tree.children).toMatchObject([{ id: note.id }]);
  expect(tree.actions[0].disabled).toBe(true);
  expect(tree.children[0]).toMatchObject({ resource: { metadata: { writable: false } } });
  const opened = tree.children[0];
  if (!("target" in opened)) throw new Error("Expected a note navigation target");
  expect(opened.target.resource).toEqual(opened.resource);
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
  expect(groups[0].nodes[0].children).toEqual([]);
  expect(groups[0].nodes[0].actions[0].disabled).toBe(true);
});
