import { afterAll, afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { traceSetupPhase } from "./setup-phase";

const previous = { path: process.env.PSTDIO_LOG_PATH, level: process.env.PSTDIO_LOG_LEVEL };
const root = mkdtempSync(join(tmpdir(), "setup-phase-"));
const logPath = join(root, "logs.jsonl");
process.env.PSTDIO_LOG_PATH = logPath;
process.env.PSTDIO_LOG_LEVEL = "warn";

afterEach(() => {
  writeFileSync(logPath, "");
});

const entries = () =>
  readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);

test("a pending setup operation is visible before it finishes at the default log level", async () => {
  const release = Promise.withResolvers<string>();
  const result = traceSetupPhase("project.extensions", { project_id: "project" }, () => release.promise);
  try {
    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toMatchObject({
      event: "runtime.setup.phase",
      phase: "project.extensions",
      state: "started",
      project_id: "project",
    });
  } finally {
    release.resolve("installed");
  }
  expect(await result).toBe("installed");
  const [start, finish] = entries();
  expect(finish).toMatchObject({ span_id: start!.span_id, state: "completed", duration_ms: expect.any(Number) });
});

test("a failed setup operation records failure and preserves the original error", async () => {
  const failure = new Error("install failed");
  let caught: unknown;
  try {
    await traceSetupPhase("extension.dependencies", {}, async () => {
      throw failure;
    });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  const [start, finish] = entries();
  expect(finish).toMatchObject({ span_id: start!.span_id, state: "failed", duration_ms: expect.any(Number) });
});

afterAll(() => {
  if (previous.path === undefined) delete process.env.PSTDIO_LOG_PATH;
  else process.env.PSTDIO_LOG_PATH = previous.path;
  if (previous.level === undefined) delete process.env.PSTDIO_LOG_LEVEL;
  else process.env.PSTDIO_LOG_LEVEL = previous.level;
  rmSync(root, { recursive: true, force: true });
});
