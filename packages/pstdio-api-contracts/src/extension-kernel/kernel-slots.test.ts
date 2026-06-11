import { describe, expect, test } from "bun:test";
import { gitEvents, sessionEvents, workspaceSlots, worktreeEvents } from "./kernel-slots";

describe("kernel slots", () => {
  test("exposes workspace header menu slots for workspace-scoped extension actions", () => {
    expect(workspaceSlots.headerPrimary.id).toBe("workspace.headerPrimary");
    expect(workspaceSlots.headerOverflow.id).toBe("workspace.headerOverflow");
  });

  test("exposes lifecycle events for extension automation", () => {
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
