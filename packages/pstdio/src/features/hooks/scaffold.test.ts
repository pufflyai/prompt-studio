import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffoldPlugins, stripTemplateSuffix } from "./scaffold";

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
    const entries = readdirSync(pluginsDir).sort();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.endsWith(".ts"))).toBe(true);

    const bootstrapPath = join(pluginsDir, "worktree-lifecycle.ts");
    expect(existsSync(bootstrapPath)).toBe(true);
  });

  test("strips .txt suffix from template files during scaffolding", async () => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const srcDir = join(tempDir, "src-plugins");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "my-plugin.ts.txt"), "export default {}");
    writeFileSync(join(srcDir, "readme.txt"), "plain text");

    const pluginsDir = join(tempDir, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    const { copyFileSync } = await import("node:fs");
    for (const entry of readdirSync(srcDir)) {
      copyFileSync(join(srcDir, entry), join(pluginsDir, stripTemplateSuffix(entry)));
    }

    expect(readdirSync(pluginsDir).sort()).toEqual(["my-plugin.ts", "readme.txt"]);
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
