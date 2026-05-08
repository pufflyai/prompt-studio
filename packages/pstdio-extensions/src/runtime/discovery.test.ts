import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverExtensionFiles, discoverExtensionFilesInDir, pstdioHomeRoot } from "./discovery";

const tempDirs: string[] = [];
const originalHome = process.env.HOME;
const originalPstdioHome = process.env.PSTDIO_HOME;

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-ext-discovery-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;

  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }

  if (originalPstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = originalPstdioHome;
  }
});

describe("discoverExtensionFilesInDir", () => {
  test("returns empty when directory missing", () => {
    expect(discoverExtensionFilesInDir("/no/such/dir")).toEqual([]);
  });

  test("returns extension.ts files for each extension folder", () => {
    const dir = createTempDir();
    mkdirSync(join(dir, "planner"));
    writeFileSync(join(dir, "planner", "extension.ts"), "export default {};");
    mkdirSync(join(dir, "lab"));
    writeFileSync(join(dir, "lab", "extension.ts"), "export default {};");

    const result = discoverExtensionFilesInDir(dir);
    expect(result).toEqual([join(dir, "lab", "extension.ts"), join(dir, "planner", "extension.ts")]);
  });

  test("skips folders without extension.ts", () => {
    const dir = createTempDir();
    mkdirSync(join(dir, "broken"));
    mkdirSync(join(dir, "planner"));
    writeFileSync(join(dir, "planner", "extension.ts"), "export default {};");

    expect(discoverExtensionFilesInDir(dir)).toEqual([join(dir, "planner", "extension.ts")]);
  });
});

describe("pstdioHomeRoot", () => {
  test("respects PSTDIO_HOME override", () => {
    process.env.PSTDIO_HOME = "/custom/home";
    expect(pstdioHomeRoot()).toBe("/custom/home");
  });

  test("falls back to $HOME/.pstdio", () => {
    delete process.env.PSTDIO_HOME;
    process.env.HOME = "/home/test";
    expect(pstdioHomeRoot()).toBe("/home/test/.pstdio");
  });
});

describe("discoverExtensionFiles", () => {
  test("uses PSTDIO_HOME/extensions when set", () => {
    const home = createTempDir();
    process.env.PSTDIO_HOME = home;
    const extensionsDir = join(home, "extensions");
    mkdirSync(extensionsDir);
    mkdirSync(join(extensionsDir, "planner"));
    writeFileSync(join(extensionsDir, "planner", "extension.ts"), "export default {};");

    expect(discoverExtensionFiles()).toEqual([join(extensionsDir, "planner", "extension.ts")]);
  });
});
