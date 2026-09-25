import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finishExtensionSmoke } from "./smoke-cleanup";
import type { SmokeResult } from "./smoke-result";

const passingResult = () =>
  ({
    host: { version: "test" },
    result: "passed",
    exitCode: 0,
    checks: [],
    coverage: { projectContext: "scratch", visited: [], unexercised: [], counts: {} },
    durations: {},
  }) satisfies SmokeResult;

test("stops the host and removes disposable files when closing the browser fails", async () => {
  const root = mkdtempSync(join(tmpdir(), "smoke-cleanup-"));
  const result: SmokeResult = passingResult();
  let hostClosed = false;
  try {
    await finishExtensionSmoke({
      root,
      result,
      closeBrowser: async () => {
        throw new Error("Browser connection lost");
      },
      closeHost: async () => {
        hostClosed = true;
      },
    });
    expect(hostClosed).toBe(true);
    expect(existsSync(root)).toBe(false);
    expect(JSON.parse(JSON.stringify(result))).toMatchObject({
      result: "failed",
      exitCode: 3,
    });
    expect(result.checks).toContainEqual({
      id: "setup",
      status: "failed",
      phase: "cleanup",
      message: "Browser connection lost",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("saves a complete retained result when closing the host fails", async () => {
  const root = mkdtempSync(join(tmpdir(), "smoke-cleanup-"));
  const result: SmokeResult = passingResult();
  try {
    await finishExtensionSmoke({
      root,
      keepHome: true,
      result,
      closeHost: async () => {
        throw new Error("Host close failed");
      },
    });
    expect(JSON.parse(readFileSync(join(root, "result.json"), "utf8"))).toMatchObject({
      result: "failed",
      exitCode: 3,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
