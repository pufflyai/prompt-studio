import { expect, test } from "bun:test";
import {
  createMemoryStorage as createIdStorage,
  createMemoryRepoFiles,
  createMemoryStorage,
  makeCommandArgs,
} from "@pstdio/sdk/testing";
import { deleteNoteCommand, renameNoteCommand } from "./commands";
import { createNote, readNoteTitle } from "./notes";

const coreIds = createIdStorage().ids;

const fixture = async () => {
  const mount = createMemoryRepoFiles();
  let files = "write";
  const [ctx] = makeCommandArgs({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      artifacts: { mount: () => mount },
      workspaces: {
        getDefault: async () => ({
          execution_kind: "local",
          provider_state: "ready",
          root_path: "/notes",
          provider_capabilities_json: { files },
        }),
      } as never,
    },
  });
  const note = await createNote(mount, coreIds.create(), "Original");
  return {
    ctx,
    mount,
    note,
    readOnly: () => {
      files = "read";
    },
  };
};
test("resource resolution supplies the current title and write capability", async () => {
  const { resolveNoteCommand } = await import("./commands");
  const { ctx, note, readOnly } = await fixture();
  await renameNoteCommand.run(ctx, { noteId: note.id, title: "Renamed" });
  readOnly();
  expect(await resolveNoteCommand.run(ctx, { noteId: note.id })).toMatchObject({
    id: note.id,
    label: "Renamed",
    metadata: { writable: false },
  });
});
test("note mutations check current permissions after a menu opens", async () => {
  const { ctx, mount, note, readOnly } = await fixture();
  readOnly();
  await expect(renameNoteCommand.run(ctx, { noteId: note.id, title: "Forbidden" })).rejects.toThrow("read-only");
  await expect(deleteNoteCommand.run(ctx, { noteId: note.id })).rejects.toThrow("read-only");
  expect(await readNoteTitle(mount, note.id)).toBe("Original");
});
