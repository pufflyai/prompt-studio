import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fireSessionResumeHook, fireSessionStartHook, fireSessionStatusHook } from "./session-hooks";

let repoDir: string;

beforeEach(async () => {
  repoDir = await realpath(await mkdtemp(join(tmpdir(), "pstdio-session-hooks-test-")));
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
});

const writeHook = (hookName: string, script: string) => {
  const hooksDir = join(repoDir, ".pstdio", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const path = join(hooksDir, hookName);
  writeFileSync(path, `#!/bin/sh\n${script}`);
  chmodSync(path, 0o755);
};

const waitForHookPayloadFile = async (path: string) => {
  for (let index = 0; index < 200; index += 1) {
    if (existsSync(path)) {
      const content = readFileSync(path, "utf8").trim();
      if (content.length > 0) return content;
    }
    await Bun.sleep(10);
  }

  throw new Error(`Timed out waiting for hook payload file: ${path}`);
};

const makeDeps = () => ({
  reposService: {
    listByProject: async () => [{ path: repoDir }],
  } as never,
  workspaceSessionsService: {
    getWorkspaceBySessionId: async () => null,
  } as never,
});

describe("fireSessionStatusHook", () => {
  test("fires post-session-success on completed", () => {
    writeHook("post-session-success", "cat");

    // fire-and-forget — just verify it doesn't throw
    fireSessionStatusHook(makeDeps(), {
      id: "sess_1",
      project_id: "proj-1",
      status: "completed",
    });
  });

  test("sends flat payload with workspace enrichment when session is linked", async () => {
    const payloadFile = join(repoDir, "post-session-success.payload.json");
    writeHook("post-session-success", `cat > "${payloadFile}"`);

    const deps = {
      reposService: {
        listByProject: async () => [{ path: repoDir }],
      } as never,
      workspaceSessionsService: {
        getWorkspaceBySessionId: async () => ({
          id: "ws-1",
          workspace_shorthand: "TP-5_A1",
          branch: "workspace/TP-5_A1",
          worktree_path: repoDir,
          attempt_status_id: "status-review-ready",
        }),
      } as never,
      attemptStatusesService: {
        list: async () => [
          { id: "status-wip", name: "wip" },
          { id: "status-review-ready", name: "review-ready" },
        ],
      } as never,
    };

    fireSessionStatusHook(deps as never, {
      id: "sess_1",
      project_id: "proj-1",
      status: "completed",
    });

    const content = await waitForHookPayloadFile(payloadFile);
    expect(JSON.parse(content)).toEqual({
      session_id: "sess_1",
      session_status: "completed",
      project_id: "proj-1",
      workspace: "TP-5_A1",
      workspace_id: "ws-1",
      worktree_path: repoDir,
      branch: "workspace/TP-5_A1",
      ticket: "TP-5",
      attempt_status: "review-ready",
    });
  });

  test("includes original_session_id in payload when set", async () => {
    const payloadFile = join(repoDir, "post-session-success-orig.payload.json");
    writeHook("post-session-success", `cat > "${payloadFile}"`);

    const deps = {
      reposService: {
        listByProject: async () => [{ path: repoDir }],
      } as never,
      workspaceSessionsService: {
        getWorkspaceBySessionId: async () => ({
          id: "ws-1",
          workspace_shorthand: "TP-5_A1",
          branch: "workspace/TP-5_A1",
          worktree_path: repoDir,
          attempt_status_id: null,
        }),
      } as never,
    };

    fireSessionStatusHook(deps as never, {
      id: "review_sess_1",
      project_id: "proj-1",
      status: "completed",
      original_session_id: "orig_sess_1",
    });

    const content = await waitForHookPayloadFile(payloadFile);
    const payload = JSON.parse(content);
    expect(payload.original_session_id).toBe("orig_sess_1");
    expect(payload.project_id).toBe("proj-1");
  });

  test("omits original_session_id from payload when not set", async () => {
    const payloadFile = join(repoDir, "post-session-success-no-orig.payload.json");
    writeHook("post-session-success", `cat > "${payloadFile}"`);

    const deps = {
      reposService: {
        listByProject: async () => [{ path: repoDir }],
      } as never,
      workspaceSessionsService: {
        getWorkspaceBySessionId: async () => null,
      } as never,
    };

    fireSessionStatusHook(deps as never, {
      id: "sess_1",
      project_id: "proj-1",
      status: "completed",
    });

    const content = await waitForHookPayloadFile(payloadFile);
    const payload = JSON.parse(content);
    expect(payload.original_session_id).toBeUndefined();
  });

  test("fires post-session-fail on failed", () => {
    writeHook("post-session-fail", "cat");

    fireSessionStatusHook(makeDeps(), {
      id: "sess_1",
      project_id: "proj-1",
      status: "failed",
    });
  });

  test("fires post-session-await-input on awaiting_input", () => {
    writeHook("post-session-await-input", "cat");

    fireSessionStatusHook(makeDeps(), {
      id: "sess_1",
      project_id: "proj-1",
      status: "awaiting_input",
    });
  });

  test("does not fire on in_progress status", () => {
    // No hook should fire for in_progress
    fireSessionStatusHook(makeDeps(), {
      id: "sess_1",
      project_id: "proj-1",
      status: "in_progress",
    });
  });
});

describe("fireSessionStartHook", () => {
  test("fires post-session-start", () => {
    writeHook("post-session-start", "cat");

    fireSessionStartHook(makeDeps(), {
      id: "sess_1",
      project_id: "proj-1",
      status: "in_progress",
    });
  });
});

describe("fireSessionResumeHook", () => {
  test("fires post-session-resume", () => {
    writeHook("post-session-resume", "cat");

    fireSessionResumeHook(makeDeps(), {
      id: "sess_1",
      project_id: "proj-1",
      status: "in_progress",
    });
  });
});
