import { describe, expect, it } from "bun:test";
import { resolveAttemptBase, resolveSessionCwd } from "./create-ticket-attempt.utils";

describe("create ticket attempt utils", () => {
  it("prefers an explicit base before branch and HEAD fallback", () => {
    expect(resolveAttemptBase({ base: " main ", branch: "feature" })).toBe("main");
    expect(resolveAttemptBase({ branch: " feature/refactor " })).toBe("feature/refactor");
    expect(resolveAttemptBase({})).toBe("HEAD");
  });

  it("uses the worktree path only for worktree sessions", () => {
    expect(
      resolveSessionCwd({
        mode: "worktree",
        worktreeMode: "worktree",
        repoPath: "/repo",
        worktreePath: "/repo/worktrees/PS-1_A1",
      }),
    ).toBe("/repo/worktrees/PS-1_A1");

    expect(
      resolveSessionCwd({
        mode: "current_branch",
        worktreeMode: "worktree",
        repoPath: "/repo",
        worktreePath: "/repo/worktrees/PS-1_A1",
      }),
    ).toBe("/repo");

    expect(
      resolveSessionCwd({
        mode: "worktree",
        worktreeMode: "worktree",
        repoPath: "/repo",
        worktreePath: null,
      }),
    ).toBe("/repo");
  });
});
