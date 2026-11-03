import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createNoteCommand } from "./commands";
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
  expect(opened).toEqual([noteTarget(note.id, note.title, ctx)]);
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
