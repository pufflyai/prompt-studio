import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { apiLogger } from "../../lib/logger";
import { fireExtensionEvent } from "./extension-event-runtime";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

const tempRoots: string[] = [];

const withRuntimeCatalog = <T extends { extensionService: object; projectService: object; repoService: object }>(
  deps: T,
) => ({
  ...deps,
  extensionRuntimeCatalog: createProjectExtensionRuntimeCatalog({
    extensionService: deps.extensionService as never,
    projectService: deps.projectService as never,
    repoService: deps.repoService as never,
  }),
});

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const writeExtension = (
  hookSource = `
    {
      id: "remember-worktree",
      ref: { kind: "hook", id: "remember-worktree" },
      event: { extensionId: "pstdio", kind: "event", id: "workspace.provision" },
      async run(ctx, event) {
        await ctx.storage.set("last-worktree", event.workspaceDir);
        await ctx.storage.set("last-workspace-id", ctx.workspaceId ?? null);
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
      engines: { pstdio: EXTENSION_API_VERSION },
      type: "module",
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `
      export default {
        hooks: [
          ${hookSource}
        ],
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
      withRuntimeCatalog({
        extensionService: {
          listEnabledSourcesForProject: async () => [
            {
              instance: { id: "instance-1" },
              installedSource: {
                id: "source-1",
                extension_id: "pstdio.extension-lab",
                source_kind: "local_path",
                source_path: sourcePath,
                status: "loaded",
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
        projectService: {
          get: async () => ({ id: "project-1", name: "Project One", shorthand: "PO" }),
        },
        sessionService: {},
        workspaceService: {
          get: async () => ({
            id: "workspace-1",
            project_id: "project-1",
            execution_kind: "local",
            worktree_path: "/trusted/worktree",
            branch: "workspace/one",
            provider_params_json: {},
            provider_ref_json: null,
          }),
        },
      }) as never,
      "project-1",
      "workspace.provision",
      { workspaceId: "workspace-1", workspaceDir: "/tmp/forged" },
    );

    expect(result.delivered).toBe(1);
    expect(writes).toEqual([
      {
        extension_instance_id: "instance-1",
        key: "last-worktree",
        project_id: "project-1",
        scope_id: "project-1",
        scope_type: "project",
        value_json: "/trusted/worktree",
      },
      {
        extension_instance_id: "instance-1",
        key: "last-workspace-id",
        project_id: "project-1",
        scope_id: "project-1",
        scope_type: "project",
        value_json: "workspace-1",
      },
    ]);
  });

  test("rejects a workspace owned by another project before hooks run", async () => {
    const sourcePath = writeExtension();
    const writes: unknown[] = [];
    const deps = withRuntimeCatalog({
      extensionService: {
        listEnabledSourcesForProject: async () => [
          {
            instance: { id: "instance-1" },
            installedSource: {
              id: "source-1",
              extension_id: "pstdio.extension-lab",
              source_kind: "local_path",
              source_path: sourcePath,
              status: "loaded",
            },
          },
        ],
      },
      extensionStorageService: {
        getKv: async () => null,
        setKv: async (input: unknown) => writes.push(input),
        deleteKv: async () => {},
        getCollectionItem: async () => null,
        listCollection: async () => [],
        setCollectionItem: async () => {},
        deleteCollectionItem: async () => {},
      },
      activityEventsService: {},
      fileService: {},
      repoService: { listByProject: async () => [] },
      projectService: { get: async () => ({ id: "project-1", name: "Project One", shorthand: "PO" }) },
      sessionService: {},
      workspaceService: {
        get: async () => ({ id: "workspace-2", project_id: "project-2" }),
      },
    }) as never;

    await expect(
      fireExtensionEvent(deps, "project-1", "workspace.provision", {
        workspaceId: "workspace-2",
        workspaceDir: "/tmp/forged",
      }),
    ).rejects.toThrow("Workspace not found for project: workspace-2");
    expect(writes).toEqual([]);
  });

  test("does not mount the main repo as workspace files after a worktree is removed", async () => {
    const sourcePath = writeExtension(`
      {
        id: "inspect-removed-worktree",
        ref: { kind: "hook", id: "inspect-removed-worktree" },
        event: { extensionId: "pstdio", kind: "event", id: "worktree.removed" },
        async run(ctx, event) {
          await ctx.storage.set("removed-context", {
            repoFiles: Boolean(ctx.repoFiles),
            workspaceFiles: Boolean(ctx.workspaceFiles),
            workspaceDir: event.workspaceDir ?? null,
          });
        },
      },
    `);
    const writes: Array<{ value_json?: unknown }> = [];

    await fireExtensionEvent(
      withRuntimeCatalog({
        extensionService: {
          listEnabledSourcesForProject: async () => [
            {
              instance: { id: "instance-1" },
              installedSource: {
                id: "source-1",
                extension_id: "pstdio.extension-lab",
                source_kind: "local_path",
                source_path: sourcePath,
                status: "loaded",
              },
            },
          ],
        },
        extensionStorageService: {
          getKv: async () => null,
          setKv: async (value: { value_json?: unknown }) => writes.push(value),
          deleteKv: async () => {},
          getCollectionItem: async () => null,
          listCollection: async () => [],
          setCollectionItem: async () => {},
          deleteCollectionItem: async () => {},
        },
        activityEventsService: {},
        fileService: {},
        repoService: { listByProject: async () => [{ id: "repo-1", path: "/repo" }] },
        projectService: { get: async () => ({ id: "project-1", name: "Project One", shorthand: "PO" }) },
        sessionService: {},
        workspaceService: {
          get: async () => ({
            id: "workspace-1",
            project_id: "project-1",
            execution_kind: "local",
            provider_id: "pstdio.worktree",
            provider_params_json: { repo_id: "repo-1" },
            provider_ref_json: null,
            worktree_path: null,
          }),
        },
      }) as never,
      "project-1",
      "worktree.removed",
      { workspaceId: "workspace-1" },
    );

    expect(writes.map((value) => value.value_json)).toEqual([
      { repoFiles: true, workspaceDir: null, workspaceFiles: false },
    ]);
  });

  test("logs extension hook failures", async () => {
    const sourcePath = writeExtension(`
      {
        id: "exploding-hook",
        ref: { kind: "hook", id: "exploding-hook" },
        event: { extensionId: "pstdio", kind: "event", id: "workspace.provision" },
        run() {
          throw new Error("boom");
        },
      },
    `);
    const warnSpy = spyOn(apiLogger, "warn").mockImplementation(() => {});

    try {
      const result = await fireExtensionEvent(
        withRuntimeCatalog({
          extensionService: {
            listEnabledSourcesForProject: async () => [
              {
                instance: { id: "instance-1" },
                installedSource: {
                  id: "source-1",
                  extension_id: "pstdio.extension-lab",
                  source_kind: "local_path",
                  source_path: sourcePath,
                  status: "loaded",
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
          projectService: {
            get: async () => ({ id: "project-1", name: "Project One", shorthand: "PO" }),
          },
          sessionService: {},
          workspaceService: {},
        }) as never,
        "project-1",
        "workspace.provision",
        { workspaceDir: "/tmp/worktree" },
      );

      expect(result.diagnostics?.[0]?.code).toBe("hook_failed");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toMatchObject({
        event: "extension.event.log",
        metadata: { eventId: "workspace.provision" },
      });
      expect(warnSpy.mock.calls[0]?.[1]).toContain('Hook "pstdio.extension-lab.hook.exploding-hook" failed: boom');
    } finally {
      warnSpy.mockRestore();
    }
  });
});
