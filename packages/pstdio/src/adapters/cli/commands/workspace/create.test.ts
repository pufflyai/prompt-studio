import { describe, expect, mock, test } from "bun:test";
import type { Workspace } from "@/features/workspaces/types";
import { createHandler } from "./create";

const mockWorkspace: Workspace = {
  id: "ws-1",
  project_id: "proj-1",
  name: "WS-1",
  workspace_shorthand: "WS-1",
  branch: "workspace/WS-1",
  root_path: "/repo/.pstdio/workspaces/WS-1",
  created_at: "2026-03-05T00:00:00.000Z",
  updated_at: "2026-03-05T00:00:00.000Z",
};

const baseDeps = {
  cwd: () => "/repo",
  findProjectRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  createStandaloneWorkspace: mock(async () => mockWorkspace) as never,
};

describe("workspaces create", () => {
  test("creates a standalone workspace when no ticket id is given", async () => {
    const createStandaloneWorkspace = mock(async () => mockWorkspace) as never;

    const handler = createHandler({ ...baseDeps, createStandaloneWorkspace });
    await handler({ provider: "pstdio.worktree", params: '{"base":"main"}', _: [], $0: "" } as never);

    expect(createStandaloneWorkspace).toHaveBeenCalledWith({
      projectId: "proj-1",
      providerId: "pstdio.worktree",
      params: { base: "main" },
    });
  });

  test("passes provider and params through to the API", async () => {
    const createStandaloneWorkspace = mock(async () => mockWorkspace) as never;

    const handler = createHandler({ ...baseDeps, createStandaloneWorkspace });
    await handler({
      provider: "example.remote",
      params: '{"repository":"acme/repo"}',
      _: [],
      $0: "",
    } as never);

    expect(createStandaloneWorkspace).toHaveBeenCalledWith({
      projectId: "proj-1",
      providerId: "example.remote",
      params: { repository: "acme/repo" },
    });
  });

  test("throws on invalid params JSON", async () => {
    const handler = createHandler(baseDeps);
    await expect(handler({ provider: "example.remote", params: "{", _: [], $0: "" } as never)).rejects.toThrow(
      "Invalid --params JSON",
    );
  });

  test("throws outside a project", async () => {
    const handler = createHandler({ ...baseDeps, findProjectRoot: () => null });
    await expect(handler({ _: [], $0: "" } as never)).rejects.toThrow("Not inside a pstdio project.");
  });
});

test("propagates the API provider validation error to the CLI error handler", async () => {
  const error = new Error(
    'Invalid params for workspace provider "pstdio.worktree": Unknown params: baseRef. Accepted params: base (main)',
  );
  const handler = createHandler({
    ...baseDeps,
    createStandaloneWorkspace: async () => {
      throw error;
    },
  });
  await expect(
    handler({ provider: "pstdio.worktree", params: '{"baseRef":"main"}', _: [], $0: "" } as never),
  ).rejects.toBe(error);
});
