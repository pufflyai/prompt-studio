import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { createNote } from "./notes";
import { resolveNotePathCommand } from "./resolve-note-path";
import { note } from "./resource-kinds";

test("note content paths open the note editor and other files stay workspace files", async () => {
  const mount = createMemoryRepoFiles();
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
          provider_capabilities_json: { files: "write" },
        }),
      } as never,
    },
  });
  const created = await createNote(mount, "Launch plan");
  const [claim] = note.paths ?? [];
  const resolve = (path: string) =>
    resolveNotePathCommand.run(ctx, { path: `${claim.prefix}${path}`, workspaceId: "workspace" });

  expect(claim.prefix).toBe(".pstdio/extension-storage/pstdio-notes/documents/");
  expect(resolveNotePathCommand.id).toBe(claim.resolve.id);
  expect(await resolve(`${created.id}/content.md`)).toMatchObject({
    resource: { type: "note", id: created.id, label: "Launch plan", metadata: { writable: true } },
    target: {
      kind: "compound",
      targets: [{ kind: "page" }, { kind: "panel", resource: { type: "note", id: created.id } }],
    },
  });
  expect(await resolve("missing/content.md")).toBeNull();
  expect(await resolve(`${created.id}/title.txt`)).toBeNull();
});
