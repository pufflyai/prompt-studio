import { describe, expect, mock, test } from "bun:test";
import { cleanupProjectArtifacts } from "./cleanup-project";

describe("cleanupProjectArtifacts", () => {
  test("persists each released provider resource before project storage is removed", async () => {
    const order: string[] = [];
    const workspaces = [
      {
        id: "remote-1",
        provider_id: "example.remote",
        project_id: "project-1",
        is_default: false,
        worktree_path: null,
      },
      {
        id: "local-1",
        provider_id: "pstdio.worktree",
        project_id: "project-1",
        is_default: false,
        worktree_path: "/repo/.worktrees/local-1",
      },
      {
        id: "root-1",
        provider_id: "pstdio.root",
        project_id: "project-1",
        is_default: true,
        worktree_path: "/repo",
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
                worktree_path: "/repo/.worktrees/local-1",
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
          worktree_path: null,
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
