import { describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler } from "./logs";

describe("logs command", () => {
  test("prints the last requested log lines", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-logs-command-"));
    const logPath = join(root, "logs.jsonl");
    const log = mock();

    try {
      writeFileSync(logPath, ["one", "two", "three"].join("\n"));
      const handler = createHandler({ log, resolveLogPath: () => logPath });

      await handler({ lines: 2, _: [], $0: "" });

      expect(log).toHaveBeenCalledWith("two\nthree");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("prints the resolved log path", async () => {
    const log = mock();
    const handler = createHandler({ log, resolveLogPath: () => "/home/user/.pstdio/logs.jsonl" });

    await handler({ path: true, _: [], $0: "" });

    expect(log).toHaveBeenCalledWith("/home/user/.pstdio/logs.jsonl");
  });

  test("fails with the resolved path when the log file does not exist", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-logs-command-missing-"));
    const logPath = join(root, "missing", "logs.jsonl");
    const log = mock();

    try {
      mkdirSync(root, { recursive: true });
      const handler = createHandler({ log, resolveLogPath: () => logPath });

      await expect(handler({ lines: 100, _: [], $0: "" })).rejects.toThrow(`No pstdio logs found at ${logPath}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
