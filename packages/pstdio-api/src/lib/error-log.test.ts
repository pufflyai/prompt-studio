import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ErrorLogEntry } from "./error-log";
import { logError, persistErrorLog } from "./error-log";

function makeEntry(overrides?: Partial<ErrorLogEntry>): ErrorLogEntry {
  return {
    level: "error",
    timestamp: "2026-03-04T12:00:00.000Z",
    method: "POST",
    path: "/v1/tickets",
    status: 500,
    message: "Something broke",
    stack: "Error: Something broke\n    at foo (bar.ts:1:1)",
    ...overrides,
  };
}

describe("logError", () => {
  it("writes NDJSON to stderr", () => {
    const stderrSpy = spyOn(process.stderr, "write").mockReturnValue(true);

    const entry = makeEntry();
    logError(entry);

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const written = stderrSpy.mock.calls[0][0] as string;
    expect(written.endsWith("\n")).toBe(true);

    const parsed = JSON.parse(written);
    expect(parsed.level).toBe("error");
    expect(parsed.method).toBe("POST");
    expect(parsed.path).toBe("/v1/tickets");
    expect(parsed.status).toBe(500);
    expect(parsed.message).toBe("Something broke");

    stderrSpy.mockRestore();
  });
});

describe("persistErrorLog", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "error-log-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates the directory and writes a .json file", () => {
    const logDir = join(tempDir, "error-logs");
    const entry = makeEntry();

    persistErrorLog(entry, logDir);

    const files = readdirSync(logDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toEndWith(".json");

    const content = JSON.parse(readFileSync(join(logDir, files[0]), "utf-8"));
    expect(content.message).toBe("Something broke");
    expect(content.method).toBe("POST");
  });

  it("uses timestamp in the filename", () => {
    const logDir = join(tempDir, "error-logs");
    const entry = makeEntry({ timestamp: "2026-03-04T12:05:23.000Z" });

    persistErrorLog(entry, logDir);

    const files = readdirSync(logDir);
    expect(files[0]).toBe("2026-03-04T12-05-23.000Z.json");
  });

  it("deletes the oldest file when cap is exceeded", () => {
    const logDir = join(tempDir, "error-logs");
    mkdirSync(logDir, { recursive: true });

    // Create 50 existing files
    for (let i = 0; i < 50; i++) {
      const ts = `2026-01-01T00-00-${String(i).padStart(2, "0")}.000Z.json`;
      writeFileSync(join(logDir, ts), "{}");
    }

    const entry = makeEntry({ timestamp: "2026-03-04T12:00:00.000Z" });
    persistErrorLog(entry, logDir);

    const files = readdirSync(logDir).sort();
    expect(files).toHaveLength(50);
    // Oldest file should be gone
    expect(files).not.toContain("2026-01-01T00-00-00.000Z.json");
    // New file should exist
    expect(files).toContain("2026-03-04T12-00-00.000Z.json");
  });

  it("does not throw when directory is not writable", () => {
    const stderrSpy = spyOn(process.stderr, "write").mockReturnValue(true);

    // Pass an invalid path that can't be created
    const badDir = "/nonexistent/deeply/nested/path/error-logs";
    const entry = makeEntry();

    expect(() => persistErrorLog(entry, badDir)).not.toThrow();

    // Should have warned to stderr
    const calls = stderrSpy.mock.calls;
    const hasWarning = calls.some((call) => (call[0] as string).includes("Failed to persist error log"));
    expect(hasWarning).toBe(true);

    stderrSpy.mockRestore();
  });
});
