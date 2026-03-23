import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus } from "../sync/event-bus";
import { isTerminalStatus, queueSessionCompleteHook } from "./session-hooks";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "session-hooks-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const writeHook = (script: string) => {
  const hooksDir = join(tempDir, ".pstdio", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(join(hooksDir, "post-session-complete"), script);
};

const buildDeps = (overrides?: {
  repoPaths?: string[];
  workspace?: Record<string, unknown> | null;
  ticket?: { ticket_id: string; ticket_shorthand: string } | null;
}) => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => (overrides?.ticket ? [overrides.ticket] : []),
        }),
      }),
    }),
  } as never,
  workspacesService: {
    getBySessionId: async () => overrides?.workspace ?? null,
  } as never,
  reposService: {
    listByProject: async () => (overrides?.repoPaths ?? [tempDir]).map((p) => ({ path: p })),
  } as never,
  eventBus: new EventBus(),
});

describe("isTerminalStatus", () => {
  test("returns true for completed", () => {
    expect(isTerminalStatus("completed")).toBe(true);
  });

  test("returns true for failed", () => {
    expect(isTerminalStatus("failed")).toBe(true);
  });

  test("returns true for cancelled", () => {
    expect(isTerminalStatus("cancelled")).toBe(true);
  });

  test("returns false for in_progress", () => {
    expect(isTerminalStatus("in_progress")).toBe(false);
  });

  test("returns false for awaiting_input", () => {
    expect(isTerminalStatus("awaiting_input")).toBe(false);
  });
});

describe("queueSessionCompleteHook", () => {
  test("skips when status is not terminal", async () => {
    writeHook('echo "should not run"');

    await queueSessionCompleteHook(buildDeps(), {
      sessionId: "s1",
      sessionStatus: "in_progress",
      projectId: "proj-1",
    });

    // no error, hook was not queued
  });

  test("skips when no repos exist", async () => {
    await queueSessionCompleteHook(buildDeps({ repoPaths: [] }), {
      sessionId: "s1",
      sessionStatus: "completed",
      projectId: "proj-1",
    });

    // no error, gracefully skipped
  });

  test("skips when hook script does not exist", async () => {
    await queueSessionCompleteHook(buildDeps(), {
      sessionId: "s1",
      sessionStatus: "completed",
      projectId: "proj-1",
    });

    // no error, hook was skipped
  });

  test("runs hook with session context", async () => {
    writeHook('echo "$PSTDIO_SESSION_ID|$PSTDIO_SESSION_STATUS|$PSTDIO_HOOK"');

    await queueSessionCompleteHook(buildDeps(), {
      sessionId: "s1",
      sessionStatus: "completed",
      projectId: "proj-1",
    });

    // hook is fire-and-forget, wait briefly for it to complete
    await Bun.sleep(500);
  });

  test("runs hook with workspace context when workspace exists", async () => {
    writeHook('echo "$PSTDIO_WORKSPACE|$PSTDIO_BRANCH|$PSTDIO_TICKET_SHORTHAND"');

    const workspace = {
      id: "w1",
      branch: "workspace/PS-1_A1",
      worktree_path: "/tmp/wt",
      workspace_shorthand: "PS-1_A1",
    };

    const ticket = { ticket_id: "t1", ticket_shorthand: "PS-1" };

    await queueSessionCompleteHook(buildDeps({ workspace, ticket }), {
      sessionId: "s1",
      sessionStatus: "completed",
      projectId: "proj-1",
    });

    await Bun.sleep(500);
  });

  test("runs hook without workspace context for standalone sessions", async () => {
    writeHook('echo "$PSTDIO_SESSION_ID"');

    await queueSessionCompleteHook(buildDeps({ workspace: null }), {
      sessionId: "s1",
      sessionStatus: "failed",
      projectId: "proj-1",
    });

    await Bun.sleep(500);
  });

  test("emits notify event when hook fails", async () => {
    writeHook("exit 1");

    const eventBus = new EventBus();
    const deps = { ...buildDeps(), eventBus };

    await queueSessionCompleteHook(deps, {
      sessionId: "s1",
      sessionStatus: "completed",
      projectId: "proj-1",
    });

    await Bun.sleep(500);

    const events = eventBus.getSince(0);
    expect(events).toHaveLength(1);
    expect(events[0].table).toBe("notifications");
    expect(events[0].op).toBe("notify");
    expect(events[0].data).toMatchObject({
      title: 'Hook "post-session-complete" failed',
      type: "error",
    });
  });
});
