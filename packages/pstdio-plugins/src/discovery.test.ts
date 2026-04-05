import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { derivePluginIdentity, discoverPluginFiles } from "./discovery";

let tempDirs: string[] = [];

const createTempPluginsDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-plugins-test-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("discoverPluginFiles", () => {
  test("returns empty array when directory does not exist", () => {
    const result = discoverPluginFiles("/non/existent/path");
    expect(result).toEqual([]);
  });

  test("finds .ts and .js files", () => {
    const dir = createTempPluginsDir();
    writeFileSync(join(dir, "plugin-a.ts"), "export default {}");
    writeFileSync(join(dir, "plugin-b.js"), "export default {}");

    const result = discoverPluginFiles(dir);
    expect(result.sort()).toEqual([join(dir, "plugin-a.ts"), join(dir, "plugin-b.js")]);
  });

  test("finds .mts, .mjs, .cts, .cjs files", () => {
    const dir = createTempPluginsDir();
    writeFileSync(join(dir, "a.mts"), "");
    writeFileSync(join(dir, "b.mjs"), "");
    writeFileSync(join(dir, "c.cts"), "");
    writeFileSync(join(dir, "d.cjs"), "");

    const result = discoverPluginFiles(dir);
    expect(result).toHaveLength(4);
  });

  test("excludes .d.ts files", () => {
    const dir = createTempPluginsDir();
    writeFileSync(join(dir, "types.d.ts"), "");
    writeFileSync(join(dir, "plugin.ts"), "");

    const result = discoverPluginFiles(dir);
    expect(result).toEqual([join(dir, "plugin.ts")]);
  });

  test("excludes .test.* and .spec.* files", () => {
    const dir = createTempPluginsDir();
    writeFileSync(join(dir, "plugin.test.ts"), "");
    writeFileSync(join(dir, "plugin.spec.js"), "");
    writeFileSync(join(dir, "plugin.ts"), "");

    const result = discoverPluginFiles(dir);
    expect(result).toEqual([join(dir, "plugin.ts")]);
  });

  test("discovers files recursively", () => {
    const dir = createTempPluginsDir();
    mkdirSync(join(dir, "actions"));
    writeFileSync(join(dir, "root.ts"), "");
    writeFileSync(join(dir, "actions", "run.js"), "");

    const result = discoverPluginFiles(dir);
    expect(result.sort()).toEqual([join(dir, "actions", "run.js"), join(dir, "root.ts")]);
  });

  test("ignores non-source files", () => {
    const dir = createTempPluginsDir();
    writeFileSync(join(dir, "readme.md"), "");
    writeFileSync(join(dir, "data.json"), "");
    writeFileSync(join(dir, "plugin.ts"), "");

    const result = discoverPluginFiles(dir);
    expect(result).toEqual([join(dir, "plugin.ts")]);
  });
});

describe("derivePluginIdentity", () => {
  test("strips root and extension", () => {
    expect(derivePluginIdentity("/root/plugins", "/root/plugins/my-plugin.ts")).toBe("my-plugin");
  });

  test("preserves subdirectory path with forward slashes", () => {
    expect(derivePluginIdentity("/root/plugins", "/root/plugins/actions/run-review.js")).toBe("actions/run-review");
  });

  test("strips compound extensions", () => {
    expect(derivePluginIdentity("/root", "/root/plugin.mts")).toBe("plugin");
    expect(derivePluginIdentity("/root", "/root/plugin.cjs")).toBe("plugin");
  });
});
