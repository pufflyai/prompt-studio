import { describe, expect, test } from "bun:test";
import { makeWorkspace } from "./workspace-provider.test-fixture";
import { resolveWorkspaceExecutionTarget } from "./workspace-provider-service";

describe("resolveWorkspaceExecutionTarget", () => {
  test("does not fall back to a project repository for remote workspaces", async () => {
    const result = await resolveWorkspaceExecutionTarget(
      {
        workspaceService: {
          get: async () =>
            makeWorkspace({
              id: "ws-remote",
              provider_state: "ready",
              execution_kind: "remote",
              worktree_path: null,
            }),
        },
        repoService: { listByProject: async () => [{ id: "repo-1", path: "/repo" }] },
      } as never,
      "ws-remote",
    );

    expect(result).toBeUndefined();
  });
});
