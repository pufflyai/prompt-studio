import { describe, expect, test } from "bun:test";
import { gitEvents, sessionEvents, workspaceCommands, worktreeEvents } from "./kernel-slots";

describe("kernel slots", () => {
  test("exposes attempt status as a host-owned workspace command", () => {
    expect(workspaceCommands.setAttemptStatus.id).toBe("kernel.workspace.setAttemptStatus");
  });

  test("exposes lifecycle events needed for plugin migration parity", () => {
    expect(sessionEvents.resumed.id).toBe("session.resumed");
    expect(sessionEvents.awaitingInput.id).toBe("session.awaitingInput");
    expect(sessionEvents.succeeded.id).toBe("session.succeeded");
    expect(sessionEvents.failed.id).toBe("session.failed");
    expect(worktreeEvents.removed.id).toBe("worktree.removed");
    expect(gitEvents.committed.id).toBe("git.committed");
    expect(gitEvents.rebased.id).toBe("git.rebased");
    expect(gitEvents.merged.id).toBe("git.merged");
    expect(gitEvents.conflicted.id).toBe("git.conflicted");
  });
});
