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
  test("copies default hooks into .pstdio/hooks", async () => {
    await scaffoldHooks(tempDir);

    const postCreatePath = join(tempDir, ".pstdio", "hooks", "post-create");
    expect(existsSync(postCreatePath)).toBe(true);

    const content = readFileSync(postCreatePath, "utf8");
    expect(content).toContain("pstdio tickets pull");
    expect(content).toContain("config.json");
  });

  test("does not overwrite existing hooks directory", async () => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const hooksDir = join(tempDir, ".pstdio", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, "post-create"), "custom script");

    await scaffoldHooks(tempDir);

    const content = readFileSync(join(hooksDir, "post-create"), "utf8");
    expect(content).toBe("custom script");
  });
});
