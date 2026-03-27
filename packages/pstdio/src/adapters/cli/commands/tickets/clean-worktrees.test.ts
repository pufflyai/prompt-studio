import { describe, expect, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler } from "./clean-worktrees";

type Workspace = {
  id: string;
  workspace_shorthand: string;
  ticket_shorthand: string;
  branch: string | null;
  worktree_path: string | null;
};

const makeWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: "ws-1",
  workspace_shorthand: "PS-1_A1",
  ticket_shorthand: "PS-1",
  branch: "workspace/PS-1_A1",
  worktree_path: "/tmp/worktrees/PS-1_A1",
  ...overrides,
});

const makeTicket = (overrides: Record<string, unknown> = {}) => ({
  id: "t-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  ...overrides,
});

const makeDeps = (overrides: Record<string, unknown> = {}) => ({
  cwd: () => "/repo",
  findGitRoot: () => "/repo" as string | null,
  readConfig: () => ({ project_id: "proj-1" }) as { project_id: string } | null,
  resolveProjectId: (_cwd: string, explicitId?: string) => ({
    projectId: explicitId ?? "proj-1",
    root: "/repo",
  }),
  resolveTicketByShorthand: mock(async () => makeTicket()),
  listWorkspaces: mock(async () => [makeWorkspace()]),
  removeWorktreeAndBranch: mock(async () => {}),
  log: mock(() => {}),
  ...overrides,
});

type Args = { id: string; "project-id"?: string };

describe("tickets clean-worktrees", () => {
  test("removes worktree and branch for each workspace", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1" } as Arguments<Args>);

    expect(deps.removeWorktreeAndBranch).toHaveBeenCalledWith({
      repoRoot: "/repo",
      path: "/tmp/worktrees/PS-1_A1",
      branch: "workspace/PS-1_A1",
      force: true,
    });
    expect(deps.log).toHaveBeenCalledWith("Removed 1 worktree(s) for ticket PS-1");
  });

  test("removes multiple worktrees for a ticket", async () => {
    const workspaces = [
      makeWorkspace({ workspace_shorthand: "PS-1_A1", worktree_path: "/tmp/wt/A1" }),
      makeWorkspace({ workspace_shorthand: "PS-1_A2", worktree_path: "/tmp/wt/A2" }),
    ];
    const deps = makeDeps({ listWorkspaces: mock(async () => workspaces) });
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1" } as Arguments<Args>);

    expect(deps.removeWorktreeAndBranch).toHaveBeenCalledTimes(2);
    expect(deps.log).toHaveBeenCalledWith("Removed 2 worktree(s) for ticket PS-1");
  });

  test("skips workspaces without a worktree path", async () => {
    const workspaces = [
      makeWorkspace({ workspace_shorthand: "PS-1_A1", worktree_path: "/tmp/wt/A1" }),
      makeWorkspace({ workspace_shorthand: "PS-1_A2", worktree_path: null }),
    ];
    const deps = makeDeps({ listWorkspaces: mock(async () => workspaces) });
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1" } as Arguments<Args>);

    expect(deps.removeWorktreeAndBranch).toHaveBeenCalledTimes(1);
  });

  test("skips workspaces for other tickets", async () => {
    const workspaces = [
      makeWorkspace({ workspace_shorthand: "PS-1_A1", ticket_shorthand: "PS-1" }),
      makeWorkspace({ workspace_shorthand: "PS-2_A1", ticket_shorthand: "PS-2" }),
    ];
    const deps = makeDeps({ listWorkspaces: mock(async () => workspaces) });
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1" } as Arguments<Args>);

    expect(deps.removeWorktreeAndBranch).toHaveBeenCalledTimes(1);
  });

  test("falls back to workspace shorthand when branch is null", async () => {
    const deps = makeDeps({
      listWorkspaces: mock(async () => [makeWorkspace({ branch: null })]),
    });
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1" } as Arguments<Args>);

    expect(deps.removeWorktreeAndBranch).toHaveBeenCalledWith(expect.objectContaining({ branch: "workspace/PS-1_A1" }));
  });

  test("logs when no worktrees found", async () => {
    const deps = makeDeps({ listWorkspaces: mock(async () => []) });
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1" } as Arguments<Args>);

    expect(deps.removeWorktreeAndBranch).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith("No worktrees found for ticket PS-1");
  });

  test("continues on failure and reports count", async () => {
    const workspaces = [
      makeWorkspace({ workspace_shorthand: "PS-1_A1", worktree_path: "/tmp/wt/A1" }),
      makeWorkspace({ workspace_shorthand: "PS-1_A2", worktree_path: "/tmp/wt/A2" }),
    ];
    let callCount = 0;
    const deps = makeDeps({
      listWorkspaces: mock(async () => workspaces),
      removeWorktreeAndBranch: mock(async () => {
        callCount++;
        if (callCount === 1) throw new Error("gone");
      }),
    });
    const handler = createHandler(deps as never);

    await handler({ id: "PS-1" } as Arguments<Args>);

    expect(deps.log).toHaveBeenCalledWith("Failed to remove worktree for PS-1_A1");
    expect(deps.log).toHaveBeenCalledWith("Removed 1 worktree(s) for ticket PS-1");
  });

  test("throws when ticket not found", async () => {
    const deps = makeDeps({ resolveTicketByShorthand: mock(async () => null) });
    const handler = createHandler(deps as never);

    await expect(handler({ id: "PS-99" } as Arguments<Args>)).rejects.toThrow("Ticket not found: PS-99");
  });

  test("throws when not in git repo", async () => {
    const deps = makeDeps({ findGitRoot: () => null });
    const handler = createHandler(deps as never);

    await expect(handler({ id: "PS-1" } as Arguments<Args>)).rejects.toThrow("Not inside a git repository.");
  });

  test("throws when not in pstdio project", async () => {
    const deps = makeDeps({ readConfig: () => null });
    const handler = createHandler(deps as never);

    await expect(handler({ id: "PS-1" } as Arguments<Args>)).rejects.toThrow(
      "Not inside a pstdio project. Run 'pstdio projects create' first.",
    );
  });
});
