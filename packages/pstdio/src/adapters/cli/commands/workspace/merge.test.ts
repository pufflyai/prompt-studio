import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./merge";

const baseDeps = {
  cwd: () => "/repo",
  findGitRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  mergeWorkspace: mock(async () => {}),
};

describe("workspaces merge", () => {
  test("delegates to mergeWorkspace", async () => {
    const mergeWorkspace = mock(async () => {});

    const handler = createHandler({ ...baseDeps, mergeWorkspace });
    await handler({ id: "PS-1_A1", _: [], $0: "" } as never);

    expect(mergeWorkspace).toHaveBeenCalledWith({
      repoRoot: "/repo",
      projectId: "proj-1",
      workspaceShorthand: "PS-1_A1",
      deleteAfter: undefined,
    });
  });

  test("passes deleteAfter flag", async () => {
    const mergeWorkspace = mock(async () => {});

    const handler = createHandler({ ...baseDeps, mergeWorkspace });
    await handler({ id: "PS-1_A1", "delete-workspace": true, _: [], $0: "" } as never);

    expect(mergeWorkspace).toHaveBeenCalledWith({
      repoRoot: "/repo",
      projectId: "proj-1",
      workspaceShorthand: "PS-1_A1",
      deleteAfter: true,
    });
  });

  test("throws when not in git repo", async () => {
    const handler = createHandler({ ...baseDeps, findGitRoot: () => null });
    await expect(handler({ id: "PS-1_A1", _: [], $0: "" } as never)).rejects.toThrow("Not inside a git repository.");
  });

  test("throws when not in pstdio project", async () => {
    const handler = createHandler({ ...baseDeps, readConfig: () => null });
    await expect(handler({ id: "PS-1_A1", _: [], $0: "" } as never)).rejects.toThrow(
      "Not inside a pstdio project. Run 'pstdio projects create' first.",
    );
  });
});
