import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createNoteCommand } from "./commands";
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
  expect(opened).toMatchObject([
    { targets: [{ kind: "page" }, { kind: "panel", resource: { id: note.id, metadata: { writable: true } } }] },
  ]);
});
