import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./startup-log";

const baseDeps = {
  cwd: () => "/repo",
  findGitRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  listWorkspaces: async () => [
    {
      id: "ws-1",
      workspace_shorthand: "PS-1_A1",
      ticket_shorthand: "PS-1",
      branch: "workspace/PS-1_A1",
      worktree_path: null,
      status: "active",
    },
  ],
  getStartupLog: async () => "hello world\n" as string | null,
  log: mock() as (...args: unknown[]) => void,
};

describe("workspaces startup-log", () => {
  test("prints startup log content", async () => {
    const log = mock();
    const handler = createHandler({ ...baseDeps, log });

    await handler({ id: "PS-1_A1", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("hello world\n");
  });

  test("prints message when no log exists", async () => {
    const log = mock();
    const handler = createHandler({
      ...baseDeps,
      getStartupLog: async () => null,
      log,
    });

    await handler({ id: "PS-1_A1", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("No startup log for workspace PS-1_A1.");
  });

  test("throws when workspace not found", async () => {
    const handler = createHandler({
      ...baseDeps,
      listWorkspaces: async () => [],
    });

    await expect(handler({ id: "PS-99_A1", _: [], $0: "" } as never)).rejects.toThrow("Workspace not found: PS-99_A1");
  });
});
