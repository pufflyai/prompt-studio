import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const readJsonLines = (filePath: string) =>
  readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const waitForLogEntry = async (
  filePath: string,
  predicate: (entry: Record<string, unknown>) => boolean,
  timeoutMs = 2000,
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (existsSync(filePath)) {
      const entries = readJsonLines(filePath);
      if (entries.some(predicate)) {
        return entries;
      }
    }

    await Bun.sleep(20);
  }

  return existsSync(filePath) ? readJsonLines(filePath) : [];
};

describe("hook logging", () => {
  const originalLogPath = process.env.PSTDIO_LOG_PATH;
  const originalLogLevel = process.env.PSTDIO_LOG_LEVEL;

  afterEach(() => {
    if (originalLogPath === undefined) {
      delete process.env.PSTDIO_LOG_PATH;
    } else {
      process.env.PSTDIO_LOG_PATH = originalLogPath;
    }

    if (originalLogLevel === undefined) {
      delete process.env.PSTDIO_LOG_LEVEL;
    } else {
      process.env.PSTDIO_LOG_LEVEL = originalLogLevel;
    }
  });

  test("runHook writes start and completion events to configured JSONL target", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "pstdio-hooks-logging-test-"));
    const logsPath = join(tmp, "logs.jsonl");
    process.env.PSTDIO_LOG_PATH = logsPath;
    process.env.PSTDIO_LOG_LEVEL = "info";

    try {
      const hookPath = join(tmp, ".pstdio", "hooks", "post-worktree-create");
      const worktreePath = join(tmp, "wt");
      mkdirSync(join(tmp, ".pstdio", "hooks"), { recursive: true });
      writeFileSync(hookPath, "#!/bin/sh\necho ok\n");
      chmodSync(hookPath, 0o755);

      const { runHook } = await import("./hooks");
      const result = await runHook("post-worktree-create", { worktree_path: worktreePath }, { repoPath: tmp });
      expect(result.exitCode).toBe(0);

      const entries = await waitForLogEntry(logsPath, (entry) => entry.event === "hook.run.completed");
      const start = entries.find((entry) => entry.event === "hook.run.start");
      const completed = entries.find((entry) => entry.event === "hook.run.completed");

      expect(start).toBeDefined();
      expect(completed).toBeDefined();
      expect(start?.component).toBe("hooks");
      expect(completed?.component).toBe("hooks");
      expect(completed?.hook_name).toBe("post-worktree-create");
      expect(completed?.exit_code).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
