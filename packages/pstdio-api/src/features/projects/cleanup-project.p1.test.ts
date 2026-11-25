import { describe, expect, mock, spyOn, test } from "bun:test";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { ensureWorkspaceConfig } from "../workspaces/workspace-config";
import { cleanupProjectArtifacts, evictProjectCopy } from "./cleanup-project";

import { prepareManagedProjectFolder } from "./managed-project-folder";

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
      return true;
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
        removeProjectStorage: () => {
          order.push("storage");
        },
      },
    );

    expect(order).toEqual(["provider:remote-1", "deleted:remote-1", "provider:local-1", "deleted:local-1", "storage"]);
  });

  test("stops project deletion when a provider backing resource cannot be removed", async () => {
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
    ).rejects.toThrow("Workspace backing resource could not be removed: local-1");
    expect(softDelete).not.toHaveBeenCalled();
    expect(removeProjectStorage).not.toHaveBeenCalled();
  });
});

test("an interrupted unbound creation stops eviction before project artifacts or secrets are deleted", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "project-creation-eviction-")));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const host = await createTestApp();
  const effects: string[] = [];
  const storage = spyOn(host.deps.fileService, "removeProjectStorage").mockImplementation(async () => {
    effects.push("storage");
  });
  const bytes = spyOn(host.deps.fileService, "removeOwnedBytes").mockImplementation(async () => {
    effects.push("bytes");
  });
  const assets = spyOn(host.deps.assetTransferService, "removeProjectBytes").mockImplementation(async () => {
    effects.push("assets");
  });
  const secrets = spyOn(host.deps.extensionConnectionService, "prepareProjectRemoval").mockImplementation(async () => {
    effects.push("secrets");
    return async () => {};
  });
  try {
    const project = await host.deps.projectService.create({ name: "Interrupted creation" });
    await prepareManagedProjectFolder(project.id);
    await expect(evictProjectCopy(host.deps, project.id)).rejects.toThrow("incomplete");
    expect(effects).toEqual([]);
    expect(await host.deps.projectService.get(project.id)).toBeDefined();
  } finally {
    storage.mockRestore();
    bytes.mockRestore();
    assets.mockRestore();
    secrets.mockRestore();
    await host.close();
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test("local project eviction cleans secrets only after their project row is deleted", async () => {
  const host = await createTestApp();
  const project = await host.deps.projectService.create({ name: "Project with credentials" });
  let deleted = false;
  const originalDelete = host.deps.projectService.delete;
  const remove = spyOn(host.deps.projectService, "delete")
    .mockRejectedValueOnce(new Error("project deletion failed"))
    .mockImplementation(async (id) => {
      deleted = await originalDelete(id);
      return deleted;
    });
  const cleanup = mock(async () => {
    expect(deleted).toBe(true);
  });
  const secrets = spyOn(host.deps.extensionConnectionService, "prepareProjectRemoval").mockResolvedValue(cleanup);
  try {
    await expect(evictProjectCopy(host.deps, project.id)).rejects.toThrow("project deletion failed");
    expect(cleanup).not.toHaveBeenCalled();
    await evictProjectCopy(host.deps, project.id);
    expect(cleanup).toHaveBeenCalledTimes(1);
  } finally {
    remove.mockRestore();
    secrets.mockRestore();
    await host.close();
  }
});
