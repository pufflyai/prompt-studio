import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apiLogger } from "../../lib/logger";
import { fireExtensionEvent } from "./extension-event-runtime";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const writeExtension = (
  hookSource = `
    rememberWorktree: {
      eventId: "worktree.created",
      async handler(ctx, event) {
        await ctx.storage.set("last-worktree", event.worktreePath);
      },
    },
  `,
) => {
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
          ${hookSource}
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
        repoService: {
          listByProject: async () => [],
        },
        sessionService: {},
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

  test("logs extension hook failures", async () => {
    const sourcePath = writeExtension(`
      explodingHook: {
        eventId: "worktree.created",
        handler() {
          throw new Error("boom");
        },
      },
    `);
    const warnSpy = spyOn(apiLogger, "warn").mockImplementation(() => {});

    try {
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
            setKv: async () => {},
            deleteKv: async () => {},
            getCollectionItem: async () => null,
            listCollection: async () => [],
            setCollectionItem: async () => {},
            deleteCollectionItem: async () => {},
          },
          activityEventsService: {},
          fileService: {},
          repoService: {
            listByProject: async () => [],
          },
          sessionService: {},
          workspaceService: {},
        } as never,
        "project-1",
        "worktree.created",
        { worktreePath: "/tmp/worktree" },
      );

      expect(result.diagnostics?.[0]?.code).toBe("hook_failed");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatchObject({
        event: "extension.event.log",
        metadata: { eventId: "worktree.created" },
      });
      expect(warnSpy.mock.calls[0]?.[1]).toContain('Hook "extension-lab.explodingHook" failed: boom');
    } finally {
      warnSpy.mockRestore();
    }
  });
});
