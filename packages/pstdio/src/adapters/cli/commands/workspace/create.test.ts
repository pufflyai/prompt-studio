import { describe, expect, mock, test } from "bun:test";
import type { Workspace } from "@/features/workspaces/types";
import { createHandler } from "./create";

const mockWorkspace: Workspace = {
  id: "ws-1",
  project_id: "proj-1",
  name: "WS-1",
  workspace_shorthand: "WS-1",
  branch: "workspace/WS-1",
  worktree_path: "/repo/.pstdio/workspaces/WS-1",
  created_at: "2026-03-05T00:00:00.000Z",
  updated_at: "2026-03-05T00:00:00.000Z",
};

const baseDeps = {
  cwd: () => "/repo",
  findGitRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  createStandaloneWorkspace: mock(async () => mockWorkspace) as never,
};

describe("workspaces create", () => {
  test("creates a standalone workspace when no ticket id is given", async () => {
    const createStandaloneWorkspace = mock(async () => mockWorkspace) as never;

    const handler = createHandler({ ...baseDeps, createStandaloneWorkspace });
    await handler({ target: "worktree", base: "main", _: [], $0: "" } as never);

    expect(createStandaloneWorkspace).toHaveBeenCalledWith({ projectId: "proj-1", base: "main" });
  });

  test("throws on invalid target", async () => {
    const handler = createHandler(baseDeps);
    await expect(handler({ target: "docker", _: [], $0: "" } as never)).rejects.toThrow(
      "Invalid target: docker. Must be 'worktree'.",
    );
  });

  test("throws when not in git repo", async () => {
    const handler = createHandler({ ...baseDeps, findGitRoot: () => null });
    await expect(handler({ target: "worktree", _: [], $0: "" } as never)).rejects.toThrow(
      "Not inside a git repository.",
    );
  });
});
