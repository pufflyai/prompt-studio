import { describe, expect, it, mock } from "bun:test";
import { continueTicketAttemptSetup, resolveAttemptBase, resolveSessionCwd } from "./create-ticket-attempt.utils";

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

  it("calls sessionService.transitionStatus to failed when ticket-attempt spawn cannot start an agent", async () => {
    const transitionStatus = mock(async () => ({ id: "session-1", project_id: "project-1", status: "failed" }));

    continueTicketAttemptSetup(
      {
        sessionService: { transitionStatus },
        eventBus: { emit: () => {} },
        agentRegistry: { get: () => null },
      } as unknown as Parameters<typeof continueTicketAttemptSetup>[0],
      {
        workspace: {
          id: "workspace-1",
          project_id: "project-1",
          worktree_path: null,
          initializing: false,
        } as never,
        ticketShorthand: "TP-1",
        repo: { path: "/repo" } as never,
        mode: "current_branch",
        worktreeMode: "worktree",
        started: {
          session: { id: "session-1" } as never,
          agentId: "missing-agent",
          prompt: "Run ticket",
          title: "Ticket attempt",
        },
        model: undefined,
      },
    );

    for (let index = 0; index < 20; index += 1) {
      if (transitionStatus.mock.calls.length > 0) break;
      await Bun.sleep(10);
    }

    expect(transitionStatus).toHaveBeenCalledWith("session-1", "failed");
  });
});
