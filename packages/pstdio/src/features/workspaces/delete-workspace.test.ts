import { describe, expect, mock, test } from "bun:test";
import { deleteWorkspace } from "./delete-workspace";
import { makeWorkspace } from "./workspace.test-fixture";

const baseDeps = {
  getWorkspace: async () => makeWorkspace({ workspace_shorthand: "PS-1_A1" }),
  deleteWorkspace: async () => {},
  log: () => {},
};

describe("delete workspace", () => {
  test("deletes a provider workspace by ID and confirms completion", async () => {
    const log = mock();
    const deleteWorkspaceApi = mock(async () => {});

    await deleteWorkspace(
      { projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
      { ...baseDeps, deleteWorkspace: deleteWorkspaceApi, log },
    );

    expect(deleteWorkspaceApi).toHaveBeenCalledTimes(1);
    expect(deleteWorkspaceApi).toHaveBeenCalledWith("ws-1");
    expect(log.mock.calls).toEqual([["Deleted workspace PS-1_A1"]]);
  });

  test("throws when workspace not found", async () => {
    await expect(
      deleteWorkspace(
        { projectId: "proj-1", workspaceShorthand: "PS-1_A99" },
        { ...baseDeps, getWorkspace: async () => null },
      ),
    ).rejects.toThrow("Workspace not found: PS-1_A99");
  });

  test("reports provider deletion errors without confirming completion", async () => {
    const log = mock();
    const deleteWorkspaceApi = mock(async () => {
      throw new Error("provider unavailable");
    });

    await expect(
      deleteWorkspace(
        { projectId: "proj-1", workspaceShorthand: "PS-1_A1" },
        { ...baseDeps, deleteWorkspace: deleteWorkspaceApi, log },
      ),
    ).rejects.toThrow("provider unavailable");
    expect(log).not.toHaveBeenCalled();
  });
});
