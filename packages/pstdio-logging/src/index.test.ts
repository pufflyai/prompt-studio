import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger, resolveDefaultLogPath } from "./index";

const readJsonLines = (filePath: string) =>
  readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

describe("resolveDefaultLogPath", () => {
  test("uses the configured db path directory when available", () => {
    const path = resolveDefaultLogPath({
      env: { PSTDIO_DB_PATH: "~/state/pstdio.db" },
      homedirPath: "/home/tester",
    });

    expect(path).toBe("/home/tester/state/logs.jsonl");
  });

  test("allows explicit log path override", () => {
    const path = resolveDefaultLogPath({
      logPath: "~/custom/output.jsonl",
      homedirPath: "/home/tester",
    });

    expect(path).toBe("/home/tester/custom/output.jsonl");
  });
});

describe("createLogger", () => {
  const originalLogPath = process.env.PSTDIO_LOG_PATH;
  const originalLogTargets = process.env.PSTDIO_LOG_TARGETS;
  const originalLogLevel = process.env.PSTDIO_LOG_LEVEL;

  afterEach(() => {
    if (originalLogPath === undefined) {
      delete process.env.PSTDIO_LOG_PATH;
    } else {
      process.env.PSTDIO_LOG_PATH = originalLogPath;
    }

    if (originalLogTargets === undefined) {
      delete process.env.PSTDIO_LOG_TARGETS;
    } else {
      process.env.PSTDIO_LOG_TARGETS = originalLogTargets;
    }

    if (originalLogLevel === undefined) {
      delete process.env.PSTDIO_LOG_LEVEL;
    } else {
      process.env.PSTDIO_LOG_LEVEL = originalLogLevel;
    }
  });

  test("defaults to error level", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-logging-level-default-test-"));
    const logPath = join(tempRoot, "logs.jsonl");

    try {
      process.env.PSTDIO_LOG_PATH = logPath;

      const logger = createLogger({ service: "pstdio-test", sync: true });
      logger.info({ event: "test.info-default" }, "info should be suppressed");
      logger.error({ event: "test.error-default" }, "error should be emitted");

      const entries = readJsonLines(logPath);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.event).toBe("test.error-default");
      expect(entries[0]?.level).toBe(50);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("writes newline-delimited JSON entries to file target", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-logging-test-"));
    const logPath = join(tempRoot, "logs.jsonl");

    try {
      process.env.PSTDIO_LOG_PATH = logPath;

      const logger = createLogger({ level: "info", service: "pstdio-test", sync: true });
      logger.info({ event: "test.event", component: "test" }, "hello");

      const entries = readJsonLines(logPath);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.event).toBe("test.event");
      expect(entries[0]?.component).toBe("test");
      expect(entries[0]?.msg).toBe("hello");
      expect(entries[0]?.service).toBe("pstdio-test");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("writes to stdout by default while also writing to the file sink", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-logging-stdout-default-test-"));
    const logPath = join(tempRoot, "logs.jsonl");
    const writes: string[] = [];
    const originalWrite = process.stdout.write;

    try {
      process.env.PSTDIO_LOG_PATH = logPath;
      delete process.env.PSTDIO_LOG_TARGETS;

      // Capture writes to verify stdout is always included in the effective stream set.
      (process.stdout as { write: typeof process.stdout.write }).write = ((chunk: string | Uint8Array) => {
        writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
        return true;
      }) as typeof process.stdout.write;

      const logger = createLogger({ level: "info", service: "pstdio-test", sync: true });
      logger.info({ event: "test.stdout-default" }, "default stdout");

      const entries = readJsonLines(logPath);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.event).toBe("test.stdout-default");
      expect(writes.some((line) => line.includes('"event":"test.stdout-default"'))).toBe(true);
    } finally {
      (process.stdout as { write: typeof process.stdout.write }).write = originalWrite;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("redacts sensitive payload fields", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-logging-redact-test-"));
    const logPath = join(tempRoot, "logs.jsonl");

    try {
      process.env.PSTDIO_LOG_PATH = logPath;

      const logger = createLogger({ level: "info", service: "pstdio-test", sync: true });
      logger.info(
        {
          event: "test.secret",
          component: "test",
          authorization: "Bearer xyz",
          api_token: "abc",
        },
        "with secret fields",
      );

      const [entry] = readJsonLines(logPath);
      expect(entry?.authorization).toBe("[Redacted]");
      expect(entry?.api_token).toBe("[Redacted]");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("configured env supplemental targets replace default file sink", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-logging-stdout-only-test-"));
    const logPath = join(tempRoot, "logs.jsonl");

    try {
      process.env.PSTDIO_LOG_PATH = logPath;
      process.env.PSTDIO_LOG_TARGETS = "stdout";

      const logger = createLogger({ level: "info", service: "pstdio-test", sync: true });
      logger.info({ event: "test.stdout-only" }, "stdout only");

      await Bun.sleep(10);
      expect(existsSync(logPath)).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("explicit targets override env supplemental targets", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-logging-explicit-targets-test-"));
    const logPath = join(tempRoot, "logs.jsonl");

    try {
      process.env.PSTDIO_LOG_PATH = logPath;
      process.env.PSTDIO_LOG_TARGETS = "stdout";

      const logger = createLogger({
        level: "info",
        service: "pstdio-test",
        sync: true,
        targets: [{ type: "file" }],
      });
      logger.info({ event: "test.explicit-targets" }, "explicit file sink");

      const entries = readJsonLines(logPath);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.event).toBe("test.explicit-targets");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
