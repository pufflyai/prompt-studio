import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deliverPostAttemptStatusHook, firePreAttemptStatusHook } from "./attempt-status-hooks";
import { createPostHookStore } from "./post-hook-store";

let repoDir: string;

beforeEach(async () => {
  repoDir = await realpath(await mkdtemp(join(tmpdir(), "pstdio-attempt-hooks-test-")));
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
  repoService: {
    listByProject: async () => [{ path: repoDir }],
  } as never,
});

describe("firePreAttemptStatusHook", () => {
  test("rejects when pre-hook exits non-zero", async () => {
    writeHook("pre-attempt-status-review-ready", 'echo "validation failed" >&2; exit 1');

    const result = await firePreAttemptStatusHook(makeDeps(), {
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "review-ready",
      payload: { workspace: "PS-1_A1" },
    });

    expect(result.rejected).toBe(true);
    expect(result.stderr).toContain("validation failed");
  });

  test("allows transition when pre-hook exits zero", async () => {
    writeHook("pre-attempt-status-review-ready", "exit 0");

    const result = await firePreAttemptStatusHook(makeDeps(), {
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "review-ready",
      payload: {},
    });

    expect(result.rejected).toBe(false);
  });

  test("allows transition when no pre-hook exists", async () => {
    const result = await firePreAttemptStatusHook(makeDeps(), {
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "review-ready",
      payload: {},
    });

    expect(result.rejected).toBe(false);
  });

  test("passes transition env vars to pre-hook", async () => {
    writeHook("pre-attempt-status-review-ready", 'echo "$PSTDIO_ATTEMPT_STATUS_FROM|$PSTDIO_ATTEMPT_STATUS_TO"');

    const result = await firePreAttemptStatusHook(makeDeps(), {
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "review-ready",
      payload: {
        attempt_status_from: "wip",
        attempt_status_to: "review-ready",
      },
    });

    expect(result.rejected).toBe(false);
    expect(result.stdout).toContain("wip|review-ready");
  });
});

describe("deliverPostAttemptStatusHook", () => {
  test("fires queued post-hook and consumes entry", async () => {
    writeHook("post-attempt-status-blocked", 'echo "delivered"');

    const store = createPostHookStore();
    store.queue("sess_1", {
      hookName: "post-attempt-status-blocked",
      statusChangeId: "sc_1",
      fromStatus: "wip",
      toStatus: "blocked",
      projectId: "proj-1",
      payload: { ticket: "PS-1", attempt_status_from: "wip", attempt_status_to: "blocked" },
    });

    const result = await deliverPostAttemptStatusHook(makeDeps(), store, "sess_1");

    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(0);
    expect(result!.stdout).toContain("delivered");
    expect(store.get("sess_1")).toBeUndefined();
  });

  test("returns null when no post-hook is queued", async () => {
    const store = createPostHookStore();
    const result = await deliverPostAttemptStatusHook(makeDeps(), store, "sess_1");
    expect(result).toBeNull();
  });

  test("returns skipped result when hook script does not exist on disk", async () => {
    const store = createPostHookStore();
    store.queue("sess_1", {
      hookName: "post-attempt-status-review-ready",
      statusChangeId: "sc_1",
      fromStatus: "wip",
      toStatus: "review-ready",
      projectId: "proj-1",
      payload: {},
    });

    const result = await deliverPostAttemptStatusHook(makeDeps(), store, "sess_1");

    expect(result).not.toBeNull();
    expect(result!.skipped).toBe(true);
    expect(store.get("sess_1")).toBeUndefined();
  });
});
