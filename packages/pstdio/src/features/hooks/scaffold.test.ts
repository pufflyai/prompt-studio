import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffoldHooks } from "./scaffold";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "pstdio-scaffold-hooks-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("scaffoldHooks", () => {
  test("writes default hooks into .pstdio/hooks", async () => {
    await scaffoldHooks(tempDir);

    const postCreatePath = join(tempDir, ".pstdio", "hooks", "post-worktree-create");
    expect(existsSync(postCreatePath)).toBe(true);

    const postCreateContent = readFileSync(postCreatePath, "utf8");
    expect(postCreateContent).toContain("pstdio tickets pull");
    expect(postCreateContent).toContain("config.json");

    const postSuccessPath = join(tempDir, ".pstdio", "hooks", "post-session-success");
    expect(existsSync(postSuccessPath)).toBe(true);

    const postSuccessContent = readFileSync(postSuccessPath, "utf8");
    expect(postSuccessContent).toContain("review-ready");
  });

  test("does not overwrite existing hooks directory", async () => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const hooksDir = join(tempDir, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, "post-worktree-create"), "custom script");

    await scaffoldHooks(tempDir);

    const content = readFileSync(join(hooksDir, "post-worktree-create"), "utf8");
    expect(content).toBe("custom script");
  });
});
