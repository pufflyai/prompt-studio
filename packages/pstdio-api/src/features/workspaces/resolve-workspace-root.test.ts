import { describe, expect, test } from "bun:test";
import { resolveWorkspaceRoot } from "./resolve-workspace-root";

describe("resolveWorkspaceRoot", () => {
  test("does not fall back to a project repository for remote workspaces", async () => {
    const result = await resolveWorkspaceRoot(
      {
        workspaceService: {
          get: async () => ({
            id: "ws-remote",
            project_id: "project-1",
            worktree_path: null,
            execution_kind: "remote",
            provider_state: "ready",
          }),
        },
        repoService: {
          listByProject: async () => [{ id: "repo-1", path: "/repo" }],
        },
      } as never,
      "ws-remote",
    );

    expect(result).toBeUndefined();
  });
});
