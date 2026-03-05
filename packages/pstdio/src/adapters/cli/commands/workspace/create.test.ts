import { describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHandler } from "./create";

describe("workspaces create", () => {
  test("creates workspace with worktree", async () => {
    const log = mock();
    const createWorktree = mock(async () => {});
    const createWorkspace = mock(async () => ({
      id: "ws-1",
      project_id: "proj-1",
      name: "PS-1/A1",
      workspace_shorthand: "PS-1/A1",
      branch: "workspace/PS-1/A1",
      worktree_path: join(homedir(), ".pstdio", "workspaces", "PS-1/A1"),
      status: "active",
      created_at: "2026-03-05T00:00:00.000Z",
      updated_at: "2026-03-05T00:00:00.000Z",
    }));

    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [
        {
          id: "t-1",
          shorthand: "PS-1",
          project_id: "proj-1",
          status_id: null,
          title: "Test",
          priority: null,
          complexity: null,
          draft: false,
          archived: false,
          status_name: null,
          tag_names: [],
          created_at: "2026-03-05T00:00:00.000Z",
        },
      ],
      createWorkspace,
      createWorktree,
      getStartupScript: async () => null,
      exec: mock() as never,
      log,
    });

    await handler({ id: "PS-1", target: "worktree", _: [], $0: "" } as never);

    expect(createWorkspace).toHaveBeenCalledTimes(1);
    expect(createWorktree).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      `Created workspace PS-1/A1 for PS-1 at ${join(homedir(), ".pstdio", "workspaces", "PS-1/A1")}`,
    );
  });

  test("throws on invalid target", async () => {
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [],
      createWorkspace: async () => ({}) as never,
      createWorktree: async () => {},
      getStartupScript: async () => null,
      exec: mock() as never,
      log: () => {},
    });

    await expect(handler({ id: "PS-1", target: "docker", _: [], $0: "" } as never)).rejects.toThrow(
      "Invalid target: docker. Must be 'worktree'.",
    );
  });

  test("throws when not in git repo", async () => {
    const handler = createHandler({
      cwd: () => "/nowhere",
      findGitRoot: () => null,
      readConfig: () => null,
      listTickets: async () => [],
      createWorkspace: async () => ({}) as never,
      createWorktree: async () => {},
      getStartupScript: async () => null,
      exec: mock() as never,
      log: () => {},
    });

    await expect(handler({ id: "PS-1", target: "worktree", _: [], $0: "" } as never)).rejects.toThrow(
      "Not inside a git repository.",
    );
  });

  test("throws when ticket not found", async () => {
    const handler = createHandler({
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [],
      createWorkspace: async () => ({}) as never,
      createWorktree: async () => {},
      getStartupScript: async () => null,
      exec: mock() as never,
      log: () => {},
    });

    await expect(handler({ id: "PS-99", target: "worktree", _: [], $0: "" } as never)).rejects.toThrow(
      "Ticket not found: PS-99",
    );
  });
});
