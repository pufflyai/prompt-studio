import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./list";

describe("workspaces list", () => {
  test("lists active workspaces", async () => {
    const log = mock();

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listWorkspaces: async () =>
        [
          {
            id: "ws-1",
            workspace_shorthand: "PS-1_A1",
            ticket_shorthand: "PS-1",
            branch: "workspace/PS-1_A1",
            worktree_path: "~/.pstdio/workspaces/PS-1_A1",
            attempt_status_id: null,
            attempt_status_name: null,
          },
        ] as never,
      log,
    });

    await handler();

    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0][0]).toContain("Workspace");
    expect(log.mock.calls[1][0]).toContain("PS-1_A1");
  });

  test("shows message when no workspaces", async () => {
    const log = mock();

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listWorkspaces: async () => [],
      log,
    });

    await handler();

    expect(log).toHaveBeenCalledWith("No active workspaces.");
  });
});
