import { afterEach, describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readStartupDiagnostics } from "./api-startup-diagnostics";

const roots: string[] = [];

const createLog = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-startup-diagnostics-"));
  roots.push(root);
  const logPath = join(root, "logs.jsonl");
  writeFileSync(logPath, `${JSON.stringify({ autostartId: "older", level: 50, message: "older failure" })}\n`);
  return { logPath, offset: statSync(logPath).size };
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("readStartupDiagnostics", () => {
  test("returns only error details written for the current auto-start", () => {
    const { logPath, offset } = createLog();
    appendFileSync(
      logPath,
      `${[
        JSON.stringify({ autostartId: "other", level: 50, message: "unrelated failure" }),
        JSON.stringify({ autostartId: "current", level: 30, msg: "request completed" }),
        JSON.stringify({
          autostartId: "current",
          level: 50,
          message: "could not open database",
          msg: "API startup failed",
          err: { message: "PANIC: could not locate a valid checkpoint record", stack: "database stack" },
        }),
      ].join("\n")}\n`,
    );

    expect(readStartupDiagnostics({ autostartId: "current", logPath, offset })).toBe(
      [
        "could not open database",
        "PANIC: could not locate a valid checkpoint record",
        "API startup failed",
        "database stack",
      ].join("\n"),
    );
  });

  test("de-duplicates fields and caps rendered diagnostics", () => {
    const { logPath, offset } = createLog();
    const message = `startup failed ${"x".repeat(10_000)}`;
    appendFileSync(
      logPath,
      `${JSON.stringify({ autostartId: "current", level: 50, message, msg: message, stack: "tail stack" })}\n`,
    );

    const diagnostics = readStartupDiagnostics({ autostartId: "current", logPath, offset });
    expect(diagnostics.length).toBeLessThanOrEqual(8_192);
    expect(diagnostics.match(/startup failed/g)).toHaveLength(1);
  });

  test("returns an empty string when the log is missing", () => {
    expect(readStartupDiagnostics({ autostartId: "current", logPath: "/missing/logs.jsonl", offset: 0 })).toBe("");
  });
});
