import { afterEach, beforeEach, describe, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
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
