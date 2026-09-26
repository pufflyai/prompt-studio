import { describe, expect, mock, test } from "bun:test";
import { createWorkspacesApi } from "../extensions/command-environment/workspaces";
import { createProviderBackedWorkspace } from "./workspace-provider-service";
import { setupWorkspaceWorktree } from "./worktree-setup";

const invalidShorthands = [
  "../outside",
  "foo/../../outside",
  "foo\\outside",
  ".",
  "..",
  "bad name",
  "bad~ref",
  "bad:ref",
];

describe("workspace shorthand identifiers", () => {
  test.each(invalidShorthands)("rejects %s before creating a workspace or invoking a provider", async (shorthand) => {
    const create = mock(async () => {
      throw new Error("Unexpected workspace creation");
    });
    const find = mock(async () => {
      throw new Error("Unexpected provider lookup");
    });
    const deps = {
      workspaceService: { create, getDefault: async () => null },
      workspaceProviderRuntime: { find },
    } as never;
    await expect(
      createProviderBackedWorkspace(deps, {
        projectId: "project-1",
        providerId: "cloud.remote",
        shorthandBase: shorthand,
      }),
    ).rejects.toThrow("Workspace shorthand");
    const workspaces = createWorkspacesApi(deps, { projectId: "project-1" }, {} as never);
    await expect(workspaces.create({ provider_id: "cloud.remote", shorthand_base: shorthand })).rejects.toThrow(
      "Workspace shorthand",
    );
    expect(create).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });

  test.each(invalidShorthands)("rejects unsafe worktree identifier %s before accessing Git", async (shorthand) => {
    await expect(
      setupWorkspaceWorktree({ repoPath: "/missing-repository", workspaceShorthand: shorthand, base: "HEAD" }),
    ).rejects.toThrow("Workspace shorthand");
  });
});
