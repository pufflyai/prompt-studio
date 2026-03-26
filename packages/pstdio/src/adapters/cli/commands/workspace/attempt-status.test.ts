import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./attempt-status";

const baseDeps = {
  cwd: () => "/repo",
  findGitRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  getWorkspace: async () => ({
    id: "ws-1",
    project_id: "proj-1",
    name: "PS-1_A1",
    workspace_shorthand: "PS-1_A1",
    branch: "workspace/PS-1_A1",
    worktree_path: "/wt/PS-1_A1",
    status: "active" as const,
    created_at: "",
    updated_at: "",
  }),
  updateAttemptStatus: mock(async () => ({})),
  log: mock(),
};

describe("workspaces attempt-status", () => {
  test("updates attempt status and logs", async () => {
    const log = mock();
    const updateAttemptStatus = mock(async () => ({}));
    const handler = createHandler({ ...baseDeps, updateAttemptStatus, log });

    await handler({
      workspace: "PS-1_A1",
      session: "sess-1",
      status: "review-ready",
      _: [],
      $0: "",
    } as never);

    expect(updateAttemptStatus).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Updated attempt status to "review-ready" for workspace PS-1_A1');
  });

  test("throws when not in git repo", async () => {
    const handler = createHandler({ ...baseDeps, findGitRoot: () => null });
    await expect(
      handler({ workspace: "PS-1_A1", session: "sess-1", status: "done", _: [], $0: "" } as never),
    ).rejects.toThrow("Not inside a git repository.");
  });

  test("throws when workspace not found", async () => {
    const handler = createHandler({ ...baseDeps, getWorkspace: async () => null });
    await expect(
      handler({ workspace: "PS-99_A1", session: "sess-1", status: "done", _: [], $0: "" } as never),
    ).rejects.toThrow("Workspace not found: PS-99_A1");
  });
});
