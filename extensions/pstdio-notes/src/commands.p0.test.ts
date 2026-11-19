import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "../extension";
import { createNoteCommand, type resolveNoteOpeningCommand } from "./commands";
import { createFolderCommand } from "./folder-commands";
import { listNotes, readNote } from "./notes";
import { noteTarget } from "./pages";

test("the palette creates and opens an empty note immediately", async () => {
  const params = createNoteCommand.palette?.[0].params;
  expect(params).toEqual({});
  const mount = createMemoryRepoFiles();
  const opened: unknown[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      artifacts: { mount: () => mount },
      workspaces: {
        getDefault: async () =>
          ({
            execution_kind: "local",
            provider_state: "ready",
            root_path: "/notes",
            provider_capabilities_json: { files: "write" },
          }) as never,
      },
      navigation: {
        open: (target) => {
          opened.push(target);
        },
      },
    },
  });

  const note = await createNoteCommand.run(ctx, params!);

  expect(await listNotes(mount)).toMatchObject([{ ...note, folderId: undefined }]);
  expect(await readNote(mount, note.id)).toBe("");
  expect(opened).toEqual([noteTarget(note.id, note.title, ctx, true)]);
  expect(opened).toMatchObject([{ kind: "page", resource: { id: note.id, metadata: { writable: true } } }]);
});

test("notes and folders use the core's record IDs", async () => {
  const storage = createMemoryStorage();
  const allocate = storage.ids.create;
  const allocated: string[] = [];
  storage.ids.create = () => {
    const id = allocate();
    allocated.push(id);
    return id;
  };
  const mount = createMemoryRepoFiles();
  const ctx = makeCommandContext({ storage, params: {}, overrides: { artifacts: { mount: () => mount } } });
  const note = await createNoteCommand.run(ctx, { title: "Core-owned note" });
  const folder = await createFolderCommand.run(ctx, { title: "Core-owned folder" });
  expect(allocated).toEqual([note.id, folder.id]);
  expect(note.id).not.toBe(folder.id);
});

for (const files of ["read", "write"] as const) {
  test(`linked notes resolve their compound opening with ${files} access`, async () => {
    const mount = createMemoryRepoFiles();
    const ctx = makeCommandContext({
      storage: createMemoryStorage(),
      params: {},
      overrides: {
        artifacts: { mount: () => mount },
        workspaces: {
          getDefault: async () =>
            ({
              execution_kind: "local",
              provider_state: "ready",
              root_path: "/notes",
              provider_capabilities_json: { files },
            }) as never,
        },
      },
    });
    const note = await createNoteCommand.run(ctx, { title: "Linked note" });
    const opener = extension.commands?.find(
      (command): command is typeof resolveNoteOpeningCommand => command.id === "notes.resolve-opening",
    );
    expect(await opener?.run(ctx, { noteId: note.id })).toEqual(
      noteTarget(note.id, note.title, ctx, files === "write"),
    );
    expect(await opener?.run(ctx, { noteId: "missing" })).toBeNull();
    ctx.workspaces.getDefault = async () => null;
    expect(await opener?.run(ctx, { noteId: note.id })).toBeNull();
  });
}
