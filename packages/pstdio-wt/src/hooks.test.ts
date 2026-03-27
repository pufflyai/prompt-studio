import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildHookEnv, listHooks, resolveHookScript, runHook } from "./hooks";
import { createTempRepo } from "./test-helpers";

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
});

afterEach(async () => {
  await repo.cleanup();
});

const writeHook = (repoPath: string, hookName: string, script: string) => {
  const hooksDir = join(repoPath, ".pstdio", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const path = join(hooksDir, hookName);
  writeFileSync(path, `#!/bin/sh\n${script}`);
  chmodSync(path, 0o755);
};

describe("resolveHookScript", () => {
  test("returns script path when hook file exists", () => {
    writeHook(repo.dir, "pre-commit", "echo lint");

    const result = resolveHookScript(repo.dir, "pre-commit");

    expect(result).toBe(join(repo.dir, ".pstdio", "hooks", "pre-commit"));
  });

  test("returns null when hook file does not exist", () => {
    const result = resolveHookScript(repo.dir, "pre-commit");

    expect(result).toBeNull();
  });
});

describe("buildHookEnv", () => {
  test("sets all PSTDIO env vars from context", () => {
    const env = buildHookEnv("pre-merge", {
      repoPath: "/repo",
      branch: "workspace/PS-1_A1",
      worktreePath: "/wt/PS-1_A1",
      workspace: "PS-1_A1",
      target: "main",
      projectId: "proj-1",
    });

    expect(env.PSTDIO_HOOK).toBe("pre-merge");
    expect(env.PSTDIO_BRANCH).toBe("workspace/PS-1_A1");
    expect(env.PSTDIO_WORKTREE_PATH).toBe("/wt/PS-1_A1");
    expect(env.PSTDIO_REPO_PATH).toBe("/repo");
    expect(env.PSTDIO_WORKSPACE).toBe("PS-1_A1");
    expect(env.PSTDIO_TARGET).toBe("main");
    expect(env.PSTDIO_PROJECT_ID).toBe("proj-1");
  });

  test("omits undefined context fields", () => {
    const env = buildHookEnv("post-worktree-create", {
      repoPath: "/repo",
      branch: "workspace/PS-1_A1",
    });

    expect(env.PSTDIO_HOOK).toBe("post-worktree-create");
    expect(env.PSTDIO_BRANCH).toBe("workspace/PS-1_A1");
    expect(env.PSTDIO_REPO_PATH).toBe("/repo");
    expect(env.PSTDIO_WORKTREE_PATH).toBeUndefined();
    expect(env.PSTDIO_TARGET).toBeUndefined();
  });

  test("includes ticket shorthand when provided", () => {
    const env = buildHookEnv("post-session-start", {
      repoPath: "/repo",
      workspace: "PS-1_A1",
      ticketShorthand: "PS-1",
    });

    expect(env.PSTDIO_TICKET).toBe("PS-1");
  });

  test("omits PSTDIO_TICKET when ticketShorthand not provided", () => {
    const env = buildHookEnv("post-session-start", {
      repoPath: "/repo",
    });

    expect(env.PSTDIO_TICKET).toBeUndefined();
  });

  test("includes commit fields when provided", () => {
    const env = buildHookEnv("post-commit", {
      repoPath: "/repo",
      commitSha: "abc123",
      commitMessage: "fix bug",
    });

    expect(env.PSTDIO_COMMIT_SHA).toBe("abc123");
    expect(env.PSTDIO_COMMIT_MESSAGE).toBe("fix bug");
  });
});

describe("runHook", () => {
  test("runs hook script and returns result", async () => {
    writeHook(repo.dir, "post-worktree-create", 'echo "hook executed"');

    const result = await runHook("post-worktree-create", { repoPath: repo.dir, worktreePath: repo.dir }, repo.dir);

    expect(result.skipped).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hook executed");
    expect(result.hook).toBe("post-worktree-create");
  });

  test("returns skipped result when hook file does not exist", async () => {
    const result = await runHook("post-worktree-create", { repoPath: repo.dir, worktreePath: repo.dir }, repo.dir);

    expect(result.skipped).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.hook).toBe("post-worktree-create");
  });

  test("blocking hook returns non-zero exit code", async () => {
    writeHook(repo.dir, "pre-commit", "exit 1");

    const result = await runHook("pre-commit", { repoPath: repo.dir, worktreePath: repo.dir }, repo.dir);

    expect(result.skipped).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.hook).toBe("pre-commit");
  });

  test("non-blocking hook catches failures and returns result", async () => {
    writeHook(repo.dir, "post-commit", "exit 1");

    const result = await runHook("post-commit", { repoPath: repo.dir, worktreePath: repo.dir }, repo.dir);

    expect(result.skipped).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.hook).toBe("post-commit");
  });

  test("sets PSTDIO env vars for hook script", async () => {
    writeHook(repo.dir, "pre-merge", 'echo "$PSTDIO_HOOK|$PSTDIO_BRANCH|$PSTDIO_TARGET"');

    const result = await runHook(
      "pre-merge",
      {
        repoPath: repo.dir,
        worktreePath: repo.dir,
        branch: "workspace/PS-1_A1",
        target: "main",
      },
      repo.dir,
    );

    expect(result.stdout.trim()).toBe("pre-merge|workspace/PS-1_A1|main");
  });

  test("runs hook in worktree path when provided", async () => {
    writeHook(repo.dir, "post-worktree-create", "pwd");

    const result = await runHook("post-worktree-create", { repoPath: repo.dir, worktreePath: repo.dir }, repo.dir);

    expect(result.stdout.trim()).toBe(repo.dir);
  });

  test("kills hook that exceeds timeout", async () => {
    writeHook(repo.dir, "post-worktree-create", "sleep 10");

    const result = await runHook("post-worktree-create", { repoPath: repo.dir, worktreePath: repo.dir }, repo.dir, {
      timeoutMs: 500,
    });

    expect(result.skipped).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("timed out");
  }, 10_000);

  test("runs pre-worktree-create hook in repo root (no worktree path)", async () => {
    writeHook(repo.dir, "pre-worktree-create", "pwd");

    const result = await runHook("pre-worktree-create", { repoPath: repo.dir }, repo.dir);

    expect(result.stdout.trim()).toBe(repo.dir);
  });

  test("passes JSON payload on stdin when provided", async () => {
    writeHook(repo.dir, "pre-ticket-creation", "cat");

    const payload = { title: "Test ticket", priority: "medium" };
    const result = await runHook("pre-ticket-creation", { repoPath: repo.dir, payload }, repo.dir);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(payload);
  });

  test("hook can modify payload via stdout", async () => {
    writeHook(repo.dir, "pre-ticket-creation", 'jq \'. + {"labels": ["needs-triage"]}\'');

    const payload = { title: "Test ticket" };
    const result = await runHook("pre-ticket-creation", { repoPath: repo.dir, payload }, repo.dir);

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.title).toBe("Test ticket");
    expect(output.labels).toEqual(["needs-triage"]);
  });

  test("empty stdout means no payload modification", async () => {
    writeHook(repo.dir, "post-session-start", "cat > /dev/null");

    const payload = { session: { id: "sess_1" } };
    const result = await runHook("post-session-start", { repoPath: repo.dir, payload }, repo.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  test("blocking hook rejection aborts with stderr message", async () => {
    writeHook(repo.dir, "pre-ticket-creation", 'echo "Missing description" >&2; exit 1');

    const payload = { title: "Incomplete" };
    const result = await runHook("pre-ticket-creation", { repoPath: repo.dir, payload }, repo.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing description");
  });

  test("runs session hooks", async () => {
    writeHook(repo.dir, "post-session-success", "cat");

    const payload = {
      session: { id: "sess_1" },
      attempt: { id: "att_1", status: "review-ready" },
    };
    const result = await runHook("post-session-success", { repoPath: repo.dir, payload }, repo.dir);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(payload);
  });
});

describe("listHooks", () => {
  test("returns all supported hooks with existence status", () => {
    writeHook(repo.dir, "pre-commit", "echo lint");
    writeHook(repo.dir, "post-worktree-create", "echo setup");

    const hooks = listHooks(repo.dir);

    // 11 worktree + 5 session + 8 ticket = 24
    expect(hooks.length).toBe(24);

    const preCommit = hooks.find((h) => h.name === "pre-commit");
    expect(preCommit?.exists).toBe(true);

    const postCreate = hooks.find((h) => h.name === "post-worktree-create");
    expect(postCreate?.exists).toBe(true);

    const preMerge = hooks.find((h) => h.name === "pre-merge");
    expect(preMerge?.exists).toBe(false);
  });

  test("returns all hooks as not existing when no hooks directory", () => {
    const hooks = listHooks(repo.dir);

    expect(hooks.every((h) => !h.exists)).toBe(true);
  });

  test("includes session and ticket hooks", () => {
    const hooks = listHooks(repo.dir);

    const sessionHook = hooks.find((h) => h.name === "post-session-start");
    expect(sessionHook).toBeDefined();
    expect(sessionHook?.blocking).toBe(false);

    const ticketHook = hooks.find((h) => h.name === "pre-ticket-creation");
    expect(ticketHook).toBeDefined();
    expect(ticketHook?.blocking).toBe(true);
  });
});
