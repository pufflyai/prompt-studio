import { describe, expect, test } from "bun:test";
import { makeWorkspace } from "./workspace-provider.test-fixture";
import { resolveWorkspaceExecutionTarget } from "./workspace-provider-service";

describe("resolveWorkspaceExecutionTarget", () => {
  test("does not fall back to a project repository for remote workspaces", async () => {
    const result = await resolveWorkspaceExecutionTarget(
      {
        workspaceService: {
          getDefault: async () => ({
            id: "home",
            project_id: "project-1",
            root_path: "/repo",
            execution_kind: "local",
            provider_id: "pstdio.root",
            provider_state: "ready",
          }),
          get: async () =>
            makeWorkspace({
              id: "ws-remote",
              provider_state: "ready",
              execution_kind: "remote",
              root_path: null,
            }),
        },
      } as never,
      "ws-remote",
    );

    expect(result).toBeUndefined();
  });
});
