import { describe, expect, mock, test } from "bun:test";
import { deleteWorkspaceWithWorktree } from "./delete-workspace";
import { makeWorkspace } from "./workspace.test-fixture";

const workspace = makeWorkspace({ workspace_shorthand: "PS_WS-1" });
const input = { repoRoot: "/repo", projectId: "proj-1", workspaceShorthand: "PS_WS-1" };
const baseDeps = { getWorkspace: async () => workspace, deleteWorkspace: async () => {}, log: () => {} };

describe("workspace deletion", () => {
  test("waits for provider deletion before reporting success", async () => {
    const deleted: string[] = [];
    const log = mock();
    await deleteWorkspaceWithWorktree(input, {
      ...baseDeps,
      deleteWorkspace: async (id) => {
        deleted.push(id);
      },
      log,
    });
    expect(deleted).toEqual([workspace.id]);
    expect(log).toHaveBeenCalledWith("Deleted workspace PS_WS-1");
  });
  test("reports provider cleanup failure", async () => {
    const log = mock();
    await expect(
      deleteWorkspaceWithWorktree(input, {
        ...baseDeps,
        deleteWorkspace: async () => {
          throw new Error("worktree locked");
        },
        log,
      }),
    ).rejects.toThrow("worktree locked");
    expect(log).not.toHaveBeenCalled();
  });
  test("reports an unknown workspace", async () => {
    await expect(deleteWorkspaceWithWorktree(input, { ...baseDeps, getWorkspace: async () => null })).rejects.toThrow(
      "Workspace not found: PS_WS-1",
    );
  });
});
