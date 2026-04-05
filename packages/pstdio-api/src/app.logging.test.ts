import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "./types";

const readJsonLines = (filePath: string) =>
  readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const waitForLogEntry = async (
  filePath: string,
  timeoutMs: number,
  predicate: (entry: Record<string, unknown>) => boolean,
) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (existsSync(filePath)) {
      try {
        const entry = readJsonLines(filePath).find(predicate);
        if (entry) {
          return entry;
        }
      } catch {
        // The async file target may expose the file before the full JSON line is flushed.
      }
    }
    await Bun.sleep(20);
  }

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return readJsonLines(filePath).find(predicate) ?? null;
  } catch {
    return null;
  }
};

describe("api logging", () => {
  let app: OpenAPIHono<AppBindings>;
  let closeDb: () => Promise<void>;
  let tempRoot: string;
  let logPath: string;
  const originalLogPath = process.env.PSTDIO_LOG_PATH;
  const originalLogLevel = process.env.PSTDIO_LOG_LEVEL;

  beforeAll(async () => {
    tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-logging-test-"));
    logPath = join(tempRoot, "logs.jsonl");
    process.env.PSTDIO_LOG_PATH = logPath;
    process.env.PSTDIO_LOG_LEVEL = "info";

    const { createApp } = await import("./app");
    const appResult = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
    });

    app = appResult.app;
    closeDb = appResult.close;
  });

  afterAll(async () => {
    await closeDb();
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
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("request lifecycle emits structured log entries", async () => {
    const response = await app.request("/healthz");
    expect(response.status).toBe(200);

    const completed = await waitForLogEntry(
      logPath,
      1_000,
      (entry) => entry.event === "api.request.completed" && entry.path === "/healthz" && entry.status === 200,
    );

    expect(completed).toBeDefined();
    expect(completed?.component).toBe("api");
    expect(typeof completed?.duration_ms).toBe("number");
  });
});
