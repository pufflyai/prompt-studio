import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHookFile } from "./create-hook";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "pstdio-create-hook-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("createHookFile", () => {
  test("creates a generic hook scaffold for supported hooks without bundled templates", async () => {
    const hookPath = await createHookFile(tempDir, "pre-commit");

    expect(hookPath).toBe(join(tempDir, ".pstdio", "hooks", "pre-commit"));
    expect(existsSync(hookPath)).toBe(true);

    const content = readFileSync(hookPath, "utf8");
    expect(content).toContain("#!/bin/sh");
    expect(content).toContain("# .pstdio/hooks/pre-commit");
  });

  test("reuses the bundled template when one exists", async () => {
    const hookPath = await createHookFile(tempDir, "post-worktree-create");
    const content = readFileSync(hookPath, "utf8");

    expect(content).toContain("pstdio tickets pull");
    expect(content).toContain("config.json");
  });

  test("reuses the bundled pre-attempt-status-review-ready template", async () => {
    const hookPath = await createHookFile(tempDir, "pre-attempt-status-review-ready");
    const content = readFileSync(hookPath, "utf8");

    expect(content).toContain("validate");
    expect(content).toContain("PSTDIO_WORKTREE_PATH");
  });

  test("reuses the bundled post-attempt-status-review-ready template", async () => {
    const hookPath = await createHookFile(tempDir, "post-attempt-status-review-ready");
    const content = readFileSync(hookPath, "utf8");

    expect(content).toContain("sessions create");
    expect(content).toContain("PSTDIO_WORKSPACE_ID");
  });

  test("reuses the bundled post-attempt-status-blocked template", async () => {
    const hookPath = await createHookFile(tempDir, "post-attempt-status-blocked");
    const content = readFileSync(hookPath, "utf8");

    expect(content).toContain("tickets update");
    expect(content).toContain("blocked");
  });

  test("reuses the bundled post-attempt-status-changes-requested template", async () => {
    const hookPath = await createHookFile(tempDir, "post-attempt-status-changes-requested");
    const content = readFileSync(hookPath, "utf8");

    expect(content).toContain("sessions follow-up");
    expect(content).toContain("PSTDIO_ORIGINAL_SESSION_ID");
  });

  test("reuses the bundled post-attempt-status-reviewed template", async () => {
    const hookPath = await createHookFile(tempDir, "post-attempt-status-reviewed");
    const content = readFileSync(hookPath, "utf8");

    expect(content).toContain("update-when-attempt-status");
    expect(content).toContain("reviewed");
  });

  test("reuses the bundled post-session-start template", async () => {
    const hookPath = await createHookFile(tempDir, "post-session-start");
    const content = readFileSync(hookPath, "utf8");

    expect(content).toContain("pstdio tickets update");
    expect(content).toContain("wip");
    expect(content).toContain("review");
  });

  test("reuses the bundled post-ticket-archive template", async () => {
    const hookPath = await createHookFile(tempDir, "post-ticket-archive");
    const content = readFileSync(hookPath, "utf8");

    expect(content).toContain("pstdio tickets worktrees remove-all");
  });

  test("fails when the hook file already exists", async () => {
    const hookPath = join(tempDir, ".pstdio", "hooks", "pre-commit");
    await Bun.write(hookPath, "echo existing");

    await expect(createHookFile(tempDir, "pre-commit")).rejects.toThrow('Hook already exists: "pre-commit"');

    expect(readFileSync(hookPath, "utf8")).toBe("echo existing");
  });
});
