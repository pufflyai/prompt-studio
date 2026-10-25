import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { createNote } from "./notes";
import { resolveNotePathCommand } from "./resolve-note-path";
import { note } from "./resource-kinds";

const fixture = () => {
  const mount = createMemoryRepoFiles();
  const workspace = { provider_state: "ready", files: "write" };
  const [ctx] = makeCommandArgs({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      artifacts: { mount: () => mount },
      workspaces: {
        getDefault: async () => ({
          execution_kind: "local",
          provider_state: workspace.provider_state,
          root_path: "/notes",
          provider_capabilities_json: { files: workspace.files },
        }),
      } as never,
    },
  });
  const [claim] = note.paths ?? [];
  const resolve = (path: string) =>
    resolveNotePathCommand.run(ctx, { path: `${claim.prefix}${path}`, workspaceId: "workspace" });
  return { mount, workspace, claim, resolve };
};

test("note content paths open the note editor and other files stay workspace files", async () => {
  const { mount, claim, resolve } = fixture();
  const created = await createNote(mount, "Launch plan");

  expect(claim.prefix).toBe(".pstdio/extension-storage/pstdio.pstdio-notes/documents/");
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

test("note paths follow the default workspace's file access", async () => {
  const { mount, workspace, resolve } = fixture();
  const created = await createNote(mount, "Launch plan");

  workspace.files = "read";
  expect(await resolve(`${created.id}/content.md`)).toMatchObject({ resource: { metadata: { writable: false } } });
  workspace.provider_state = "initializing";
  expect(await resolve(`${created.id}/content.md`)).toBeNull();
});
