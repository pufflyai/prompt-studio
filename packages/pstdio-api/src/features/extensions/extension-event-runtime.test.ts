import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fireExtensionEvent } from "./extension-event-runtime";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const writeExtension = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-extension-event-test-"));
  tempRoots.push(root);

  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "extension-lab",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
      type: "module",
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `
      export default {
        hooks: {
          rememberWorktree: {
            eventId: "worktree.created",
            async handler(ctx, event) {
              await ctx.storage.set("last-worktree", event.worktreePath);
            },
          },
        },
      };
    `,
  );

  return root;
};

describe("fireExtensionEvent", () => {
  test("dispatches a host event to enabled extension hooks", async () => {
    const sourcePath = writeExtension();
    const writes: unknown[] = [];

    const result = await fireExtensionEvent(
      {
        extensionService: {
          listEnabledSourcesForProject: async () => [
            {
              instance: { id: "instance-1" },
              installedSource: {
                id: "source-1",
                extension_id: "pstdio.extension-lab",
                source_kind: "local",
                source_path: sourcePath,
              },
            },
          ],
        },
        extensionStorageService: {
          getKv: async () => null,
          setKv: async (input: unknown) => {
            writes.push(input);
          },
          deleteKv: async () => {},
          getCollectionItem: async () => null,
          listCollection: async () => [],
          setCollectionItem: async () => {},
          deleteCollectionItem: async () => {},
        },
        activityEventsService: {},
        fileService: {},
        repoService: {},
        sessionService: {},
        statusService: {},
        ticketService: {},
        workspaceService: {},
      } as never,
      "project-1",
      "worktree.created",
      { worktreePath: "/tmp/worktree" },
    );

    expect(result.delivered).toBe(1);
    expect(writes).toEqual([
      {
        extension_instance_id: "instance-1",
        key: "last-worktree",
        project_id: "project-1",
        scope_id: "project-1",
        scope_type: "project",
        value_json: "/tmp/worktree",
      },
    ]);
  });
});
