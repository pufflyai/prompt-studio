import { describe, expect, mock, test } from "bun:test";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { ensureWorkspaceConfig } from "../workspaces/workspace-config";
import { cleanupProjectArtifacts } from "./cleanup-project";

describe("cleanupProjectArtifacts", () => {
  test("preserves the folder binding when project storage cannot be removed", async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "project-cleanup-")));
    const host = await createTestApp();
    try {
      const project = await host.deps.projectService.create({ name: "Cleanup" });
      const workspace = await host.deps.workspaceService.ensureDefault({
        project_id: project.id,
        root_path: root,
        name: "Project folder",
      });
      await ensureWorkspaceConfig(root, root, workspace.id, project.id, host.deps);
      const config = join(root, ".pstdio/config.json");
      const original = await readFile(config, "utf8");
      await expect(
        cleanupProjectArtifacts(host.deps, project.id, {
          removeProjectStorage: () => {
            throw new Error("storage busy");
          },
        }),
      ).rejects.toThrow("storage busy");
      expect(await readFile(config, "utf8")).toBe(original);
    } finally {
      await host.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("persists each released provider resource before project storage is removed", async () => {
    const order: string[] = [];
    const workspaces = [
      {
        id: "remote-1",
        provider_id: "example.remote",
        project_id: "project-1",
        is_default: false,
        root_path: null,
      },
      {
        id: "local-1",
        provider_id: "pstdio.worktree",
        project_id: "project-1",
        is_default: false,
        root_path: "/repo/.worktrees/local-1",
      },
      {
        id: "root-1",
        provider_id: "pstdio.root",
        project_id: "project-1",
        is_default: true,
        root_path: "/repo",
      },
    ];
    const deleteProviderWorkspace = mock(async (_deps: unknown, workspace: { id: string }) => {
      order.push(`provider:${workspace.id}`);
      return workspace.id === "local-1";
    });

    await cleanupProjectArtifacts(
      {
        workspaceService: {
          listForProviderReconciliation: async () => workspaces,
          softDelete: async (id: string) => order.push(`deleted:${id}`),
        },
      } as never,
      "project-1",
      {
        deleteProviderWorkspace: deleteProviderWorkspace as never,
        removeProjectStorage: () => order.push("storage"),
      },
    );

    expect(order).toEqual(["provider:remote-1", "deleted:remote-1", "provider:local-1", "deleted:local-1", "storage"]);
  });

  test("stops project deletion when a local worktree cannot be removed", async () => {
    const removeProjectStorage = mock(() => {});
    const softDelete = mock(async () => {});

    await expect(
      cleanupProjectArtifacts(
        {
          workspaceService: {
            listForProviderReconciliation: async () => [
              {
                id: "local-1",
                provider_id: "pstdio.worktree",
                project_id: "project-1",
                is_default: false,
                root_path: "/repo/.worktrees/local-1",
              },
            ],
            softDelete,
          },
        } as never,
        "project-1",
        {
          deleteProviderWorkspace: mock(async () => false) as never,
          removeProjectStorage,
        },
      ),
    ).rejects.toThrow("Workspace worktree could not be removed: local-1");
    expect(softDelete).not.toHaveBeenCalled();
    expect(removeProjectStorage).not.toHaveBeenCalled();
  });

  test("skips provider cleanup already persisted by an earlier attempt", async () => {
    const deleteProviderWorkspace = mock(async () => false);
    const softDelete = mock(async () => {});
    const listForProviderReconciliation = mock()
      .mockResolvedValueOnce([
        {
          id: "remote-1",
          provider_id: "example.remote",
          project_id: "project-1",
          is_default: false,
          root_path: null,
        },
      ])
      .mockResolvedValueOnce([]);
    const removeProjectStorage = mock(() => {
      throw new Error("storage busy");
    });
    const deps = { workspaceService: { listForProviderReconciliation, softDelete } } as never;

    await expect(
      cleanupProjectArtifacts(deps, "project-1", {
        deleteProviderWorkspace: deleteProviderWorkspace as never,
        removeProjectStorage,
      }),
    ).rejects.toThrow("storage busy");
    await expect(
      cleanupProjectArtifacts(deps, "project-1", {
        deleteProviderWorkspace: deleteProviderWorkspace as never,
        removeProjectStorage,
      }),
    ).rejects.toThrow("storage busy");

    expect(deleteProviderWorkspace).toHaveBeenCalledTimes(1);
    expect(softDelete).toHaveBeenCalledTimes(1);
  });
});
