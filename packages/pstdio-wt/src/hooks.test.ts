import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildEnvFromPayload, listHooks, parsePayloadOverride, resolveHookScript, runHook } from "./hooks";
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

describe("buildEnvFromPayload", () => {
  test("sets PSTDIO env vars from flat payload keys", () => {
    const env = buildEnvFromPayload("pre-merge", {
      repo_path: "/repo",
      branch: "workspace/PS-1_A1",
      worktree_path: "/wt/PS-1_A1",
      workspace: "PS-1_A1",
      target: "main",
      project_id: "proj-1",
    });

    expect(env.PSTDIO_HOOK).toBe("pre-merge");
    expect(env.PSTDIO_BRANCH).toBe("workspace/PS-1_A1");
    expect(env.PSTDIO_WORKTREE_PATH).toBe("/wt/PS-1_A1");
    expect(env.PSTDIO_REPO_PATH).toBe("/repo");
    expect(env.PSTDIO_WORKSPACE).toBe("PS-1_A1");
    expect(env.PSTDIO_TARGET).toBe("main");
    expect(env.PSTDIO_PROJECT_ID).toBe("proj-1");
  });

  test("omits null and undefined values", () => {
    const env = buildEnvFromPayload("post-worktree-create", {
      repo_path: "/repo",
      branch: "workspace/PS-1_A1",
      worktree_path: null,
      target: undefined,
    });

    expect(env.PSTDIO_HOOK).toBe("post-worktree-create");
    expect(env.PSTDIO_BRANCH).toBe("workspace/PS-1_A1");
    expect(env.PSTDIO_REPO_PATH).toBe("/repo");
    expect(env.PSTDIO_WORKTREE_PATH).toBeUndefined();
    expect(env.PSTDIO_TARGET).toBeUndefined();
  });

  test("includes ticket field when provided", () => {
    const env = buildEnvFromPayload("post-session-start", {
      workspace: "PS-1_A1",
      ticket: "PS-1",
    });

    expect(env.PSTDIO_TICKET).toBe("PS-1");
  });

  test("omits PSTDIO_TICKET when not in payload", () => {
    const env = buildEnvFromPayload("post-session-start", {
      workspace: "PS-1_A1",
    });

    expect(env.PSTDIO_TICKET).toBeUndefined();
  });

  test("serializes array values as JSON strings", () => {
    const env = buildEnvFromPayload("pre-ticket-creation", {
      tag_ids: ["tag_bug", "tag_backend"],
      tag_names: ["bug", "backend"],
      file_ids: ["file_1"],
    });

    expect(env.PSTDIO_TAG_IDS).toBe('["tag_bug","tag_backend"]');
    expect(env.PSTDIO_TAG_NAMES).toBe('["bug","backend"]');
    expect(env.PSTDIO_FILE_IDS).toBe('["file_1"]');
  });

  test("includes status transition fields", () => {
    const env = buildEnvFromPayload("post-ticket-status-change", {
      from_status: "wip",
      to_status: "review",
    });

    expect(env.PSTDIO_FROM_STATUS).toBe("wip");
    expect(env.PSTDIO_TO_STATUS).toBe("review");
  });

  test("converts boolean and number values to strings", () => {
    const env = buildEnvFromPayload("pre-ticket-creation", {
      draft: false,
      archived: true,
      squash: true,
    });

    expect(env.PSTDIO_DRAFT).toBe("false");
    expect(env.PSTDIO_ARCHIVED).toBe("true");
    expect(env.PSTDIO_SQUASH).toBe("true");
  });
});

describe("runHook", () => {
  test("runs hook script and returns result", async () => {
    writeHook(repo.dir, "post-worktree-create", 'echo "hook executed"');

    const result = await runHook("post-worktree-create", { worktree_path: repo.dir }, { repoPath: repo.dir });

    expect(result.skipped).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hook executed");
    expect(result.hook).toBe("post-worktree-create");
  });

  test("returns skipped result when hook file does not exist", async () => {
    const result = await runHook("post-worktree-create", { worktree_path: repo.dir }, { repoPath: repo.dir });

    expect(result.skipped).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.hook).toBe("post-worktree-create");
  });

  test("blocking hook returns non-zero exit code", async () => {
    writeHook(repo.dir, "pre-commit", "exit 1");

    const result = await runHook("pre-commit", { worktree_path: repo.dir }, { repoPath: repo.dir });

    expect(result.skipped).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.hook).toBe("pre-commit");
  });

  test("non-blocking hook catches failures and returns result", async () => {
    writeHook(repo.dir, "post-commit", "exit 1");

    const result = await runHook("post-commit", { worktree_path: repo.dir }, { repoPath: repo.dir });

    expect(result.skipped).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.hook).toBe("post-commit");
  });

  test("sets PSTDIO env vars from payload", async () => {
    writeHook(repo.dir, "pre-merge", 'echo "$PSTDIO_HOOK|$PSTDIO_BRANCH|$PSTDIO_TARGET"');

    const result = await runHook(
      "pre-merge",
      { branch: "workspace/PS-1_A1", target: "main", worktree_path: repo.dir },
      { repoPath: repo.dir },
    );

    expect(result.stdout.trim()).toBe("pre-merge|workspace/PS-1_A1|main");
  });

  test("runs hook in worktree_path from payload when no cwd option", async () => {
    writeHook(repo.dir, "post-worktree-create", "pwd");

    const result = await runHook("post-worktree-create", { worktree_path: repo.dir }, { repoPath: repo.dir });

    expect(result.stdout.trim()).toBe(repo.dir);
  });

  test("kills hook that exceeds timeout", async () => {
    writeHook(repo.dir, "post-worktree-create", "sleep 10");

    const result = await runHook(
      "post-worktree-create",
      { worktree_path: repo.dir },
      { repoPath: repo.dir, timeoutMs: 500 },
    );

    expect(result.skipped).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("timed out");
  }, 10_000);

  test("runs pre-worktree-create hook in repo root (no worktree_path)", async () => {
    writeHook(repo.dir, "pre-worktree-create", "pwd");

    const result = await runHook("pre-worktree-create", {}, { repoPath: repo.dir });

    expect(result.stdout.trim()).toBe(repo.dir);
  });

  test("passes JSON payload on stdin", async () => {
    writeHook(repo.dir, "pre-ticket-creation", "cat");

    const payload = { title: "Test ticket", priority: "medium" };
    const result = await runHook("pre-ticket-creation", payload, { repoPath: repo.dir });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(payload);
  });

  test("captures hook stdout output", async () => {
    writeHook(repo.dir, "pre-ticket-creation", 'jq \'. + {"labels": ["needs-triage"]}\'');

    const payload = { title: "Test ticket" };
    const result = await runHook("pre-ticket-creation", payload, { repoPath: repo.dir });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.title).toBe("Test ticket");
    expect(output.labels).toEqual(["needs-triage"]);
  });

  test("empty stdout means no output", async () => {
    writeHook(repo.dir, "post-session-start", "cat > /dev/null");

    const payload = { session_id: "sess_1", session_status: "in_progress" };
    const result = await runHook("post-session-start", payload, { repoPath: repo.dir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  test("blocking hook rejection aborts with stderr message", async () => {
    writeHook(repo.dir, "pre-ticket-creation", 'echo "Missing description" >&2; exit 1');

    const payload = { title: "Incomplete" };
    const result = await runHook("pre-ticket-creation", payload, { repoPath: repo.dir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing description");
  });

  test("runs session hooks with flat payload", async () => {
    writeHook(repo.dir, "post-session-success", "cat");

    const payload = {
      session_id: "sess_1",
      session_status: "completed",
      attempt_status: "review-ready",
    };
    const result = await runHook("post-session-success", payload, { repoPath: repo.dir });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(payload);
  });
});

describe("parsePayloadOverride", () => {
  test("returns null when no marker present", () => {
    expect(parsePayloadOverride("some log output\nmore logs")).toBeNull();
  });

  test("returns null for plain JSON without marker", () => {
    expect(parsePayloadOverride('{"key": "value"}')).toBeNull();
  });

  test("parses payload from PSTDIO_PAYLOAD= marker", () => {
    const result = parsePayloadOverride('PSTDIO_PAYLOAD={"priority":"medium"}');
    expect(result).toEqual({ priority: "medium" });
  });

  test("returns last marker when multiple present", () => {
    const stdout = 'PSTDIO_PAYLOAD={"first":true}\nlog line\nPSTDIO_PAYLOAD={"second":true}';
    expect(parsePayloadOverride(stdout)).toEqual({ second: true });
  });

  test("ignores log lines mixed with marker", () => {
    const stdout = 'Hook checks passed\nPSTDIO_PAYLOAD={"notified":true}\nDone';
    expect(parsePayloadOverride(stdout)).toEqual({ notified: true });
  });

  test("returns null for invalid JSON after marker", () => {
    expect(parsePayloadOverride("PSTDIO_PAYLOAD=not-json")).toBeNull();
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
