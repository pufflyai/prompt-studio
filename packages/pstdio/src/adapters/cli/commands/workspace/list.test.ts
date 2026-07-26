import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./list";

describe("workspaces list", () => {
  const workspace = {
    id: "7d08f5cf-f788-4106-87e9-2f39d92576ea",
    workspace_shorthand: "default",
    branch: "main",
    worktree_path: null,
  };

  test("lists active workspaces with their complete IDs", async () => {
    const log = mock();

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listWorkspaces: async () => [workspace] as never,
      log,
    });

    await handler();

    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0][0]).toContain("Workspace");
    expect(log.mock.calls[0][0]).toContain("ID");
    expect(log.mock.calls[0][0]).not.toContain("Ticket");
    expect(log.mock.calls[1][0]).toContain("default");
    expect(log.mock.calls[1][0]).toContain(workspace.id);
    expect(log.mock.calls[1][0]).not.toContain("TICKET-9");
  });

  test("prints complete workspace records as JSON", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listWorkspaces: async () => [workspace] as never,
      log,
    });

    await handler({ json: true });

    expect(JSON.parse(log.mock.calls[0][0])).toEqual([workspace]);
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

  test("prints an empty array in JSON mode when no workspaces exist", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listWorkspaces: async () => [],
      log,
    });

    await handler({ json: true });

    expect(log).toHaveBeenCalledWith("[]");
  });
});
