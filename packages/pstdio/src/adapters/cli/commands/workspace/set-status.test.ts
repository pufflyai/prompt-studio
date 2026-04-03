import { describe, expect, mock, test } from "bun:test";
import yargs from "yargs";
import { createHandler, detectWorkspaceFromBranch } from "./set-status";

const baseDeps = {
  cwd: () => "/repo",
  env: () => process.env,
  findGitRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  getWorkspace: async () => ({
    id: "ws-1",
    project_id: "proj-1",
    name: "PS-1_A1",
    workspace_shorthand: "PS-1_A1",
    branch: "workspace/PS-1_A1",
    worktree_path: "/wt/PS-1_A1",
    created_at: "",
    updated_at: "",
  }),
  updateAttemptStatus: mock(async () => ({})),
  getCurrentBranch: () => "workspace/PS-1_A1",
  log: mock(),
};

describe("workspaces set-status", () => {
  test("updates attempt status with explicit workspace", async () => {
    const log = mock();
    const updateAttemptStatus = mock(async () => ({}));
    const handler = createHandler({ ...baseDeps, updateAttemptStatus, log });

    await handler({ workspace: "PS-1_A1", status: "review-ready", _: [], $0: "" } as never);

    expect(updateAttemptStatus).toHaveBeenCalledTimes(1);
    expect(updateAttemptStatus).toHaveBeenCalledWith("http://localhost:19840", "ws-1", "review-ready", undefined);
    expect(log).toHaveBeenCalledWith('Updated attempt status to "review-ready" for workspace PS-1_A1');
  });

  test("passes session id when provided", async () => {
    const updateAttemptStatus = mock(async () => ({}));
    const handler = createHandler({ ...baseDeps, updateAttemptStatus });

    await handler({ workspace: "PS-1_A1", status: "review-ready", "session-id": "sess-123", _: [], $0: "" } as never);

    expect(updateAttemptStatus).toHaveBeenCalledWith("http://localhost:19840", "ws-1", "review-ready", "sess-123");
  });

  test("falls back to PSTDIO_SESSION_ID from env", async () => {
    const updateAttemptStatus = mock(async () => ({}));
    const originalSessionId = process.env.PSTDIO_SESSION_ID;
    process.env.PSTDIO_SESSION_ID = "sess-from-env";

    try {
      const handler = createHandler({ ...baseDeps, updateAttemptStatus });

      await handler({ workspace: "PS-1_A1", status: "review-ready", _: [], $0: "" } as never);
    } finally {
      if (originalSessionId === undefined) {
        delete process.env.PSTDIO_SESSION_ID;
      } else {
        process.env.PSTDIO_SESSION_ID = originalSessionId;
      }
    }

    expect(updateAttemptStatus).toHaveBeenCalledWith("http://localhost:19840", "ws-1", "review-ready", "sess-from-env");
  });

  test("prefers explicit session id over PSTDIO_SESSION_ID from env", async () => {
    const updateAttemptStatus = mock(async () => ({}));
    const originalSessionId = process.env.PSTDIO_SESSION_ID;
    process.env.PSTDIO_SESSION_ID = "sess-from-env";

    try {
      const handler = createHandler({ ...baseDeps, updateAttemptStatus });

      await handler({
        workspace: "PS-1_A1",
        status: "review-ready",
        "session-id": "sess-explicit",
        _: [],
        $0: "",
      } as never);
    } finally {
      if (originalSessionId === undefined) {
        delete process.env.PSTDIO_SESSION_ID;
      } else {
        process.env.PSTDIO_SESSION_ID = originalSessionId;
      }
    }

    expect(updateAttemptStatus).toHaveBeenCalledWith("http://localhost:19840", "ws-1", "review-ready", "sess-explicit");
  });

  test("auto-detects workspace from branch", async () => {
    const log = mock();
    const updateAttemptStatus = mock(async () => ({}));
    const handler = createHandler({
      ...baseDeps,
      getCurrentBranch: () => "workspace/PS-2_A1",
      getWorkspace: async () => ({
        id: "ws-2",
        project_id: "proj-1",
        name: "PS-2_A1",
        workspace_shorthand: "PS-2_A1",
        branch: "workspace/PS-2_A1",
        worktree_path: "/wt/PS-2_A1",
        created_at: "",
        updated_at: "",
      }),
      updateAttemptStatus,
      log,
    });

    await handler({ status: "wip", _: [], $0: "" } as never);

    expect(updateAttemptStatus).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Updated attempt status to "wip" for workspace PS-2_A1');
  });

  test("throws when workspace cannot be detected", async () => {
    const handler = createHandler({ ...baseDeps, getCurrentBranch: () => "main" });
    await expect(handler({ status: "done", _: [], $0: "" } as never)).rejects.toThrow(
      "Could not detect workspace. Pass --workspace or run from a workspace branch.",
    );
  });

  test("throws when not in git repo", async () => {
    const handler = createHandler({ ...baseDeps, findGitRoot: () => null });
    await expect(handler({ workspace: "PS-1_A1", status: "done", _: [], $0: "" } as never)).rejects.toThrow(
      "Not inside a git repository.",
    );
  });

  test("throws when workspace not found", async () => {
    const handler = createHandler({ ...baseDeps, getWorkspace: async () => null });
    await expect(handler({ workspace: "PS-99_A1", status: "done", _: [], $0: "" } as never)).rejects.toThrow(
      "Workspace not found: PS-99_A1",
    );
  });
});

describe("detectWorkspaceFromBranch", () => {
  test("extracts shorthand from workspace branch", () => {
    expect(detectWorkspaceFromBranch("workspace/PS-1_A1")).toBe("PS-1_A1");
  });

  test("returns null for non-workspace branch", () => {
    expect(detectWorkspaceFromBranch("main")).toBeNull();
    expect(detectWorkspaceFromBranch("feature/foo")).toBeNull();
  });

  test("returns null for null branch", () => {
    expect(detectWorkspaceFromBranch(null)).toBeNull();
  });

  test("returns null for bare prefix", () => {
    expect(detectWorkspaceFromBranch("workspace/")).toBeNull();
  });
});

describe("help", () => {
  test("includes command to list available attempt statuses", async () => {
    const { builder } = await import("./set-status");
    const cli = builder(
      yargs([])
        .exitProcess(false)
        .fail(() => {}),
    );
    const help = await cli.getHelp();
    expect(help).toContain("pstdio workspaces list-statuses");
  });
});
