import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffoldPlugins } from "./scaffold";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "pstdio-scaffold-plugins-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("scaffoldPlugins", () => {
  test("writes default plugins into .pstdio/plugins", async () => {
    await scaffoldPlugins(tempDir);

    const pluginsDir = join(tempDir, ".pstdio", "plugins");
    expect(readdirSync(pluginsDir).sort()).toEqual([
      "code-review-lifecycle.ts",
      "ticket-actions.ts",
      "ticket-lifecycle.ts",
      "workspace-actions.ts",
      "worktree-lifecycle.ts",
    ]);

    const bootstrapPath = join(pluginsDir, "worktree-lifecycle.ts");
    expect(existsSync(bootstrapPath)).toBe(true);

    const content = readFileSync(bootstrapPath, "utf8");
    expect(content).toContain("postWorktreeCreate");
    expect(content).toContain("bootstrapWorktree");
  });

  test("does not overwrite existing plugins directory", async () => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const pluginsDir = join(tempDir, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(join(pluginsDir, "custom.ts"), "custom plugin");

    await scaffoldPlugins(tempDir);

    const content = readFileSync(join(pluginsDir, "custom.ts"), "utf8");
    expect(content).toBe("custom plugin");
  });
});
