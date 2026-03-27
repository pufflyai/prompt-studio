import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fireHook } from "./fire-hook";

let repoDir: string;

beforeEach(async () => {
  repoDir = await realpath(await mkdtemp(join(tmpdir(), "pstdio-fire-hook-test-")));
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
});

describe("fireHook", () => {
  test("fires hook with JSON payload on stdin", async () => {
    writeHook("post-session-start", "cat");

    const result = await fireHook(makeDeps(), {
      hookName: "post-session-start",
      projectId: "proj-1",
      payload: { session: { id: "sess_1" } },
    });

    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(0);
    expect(JSON.parse(result!.stdout)).toEqual({ session: { id: "sess_1" } });
  });

  test("returns null when project has no repos", async () => {
    const deps = {
      reposService: {
        listByProject: async () => [],
      } as never,
    };

    const result = await fireHook(deps, {
      hookName: "post-session-start",
      projectId: "proj-1",
      payload: { session: { id: "sess_1" } },
    });

    expect(result).toBeNull();
  });

  test("returns skipped when hook script does not exist", async () => {
    const result = await fireHook(makeDeps(), {
      hookName: "post-session-start",
      projectId: "proj-1",
      payload: { session: { id: "sess_1" } },
    });

    expect(result).not.toBeNull();
    expect(result!.skipped).toBe(true);
  });

  test("blocking hook can reject via non-zero exit", async () => {
    writeHook("pre-ticket-creation", 'echo "rejected" >&2; exit 1');

    const result = await fireHook(makeDeps(), {
      hookName: "pre-ticket-creation",
      projectId: "proj-1",
      payload: { title: "Test" },
    });

    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(1);
    expect(result!.stderr).toContain("rejected");
  });
});
