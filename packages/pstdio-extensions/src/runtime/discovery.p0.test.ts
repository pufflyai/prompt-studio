import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { discoverExtensionPackages, discoverExtensionPackagesInUserRoot, pstdioHomeRoot } from "./discovery";

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

describe("discoverExtensionPackages", () => {
  test("returns empty when directory missing", () => {
    expect(discoverExtensionPackages("/no/such/dir")).toEqual([]);
  });

  test("returns package directories for each extension folder", () => {
    const dir = createTempDir();
    mkdirSync(join(dir, "planner"));
    writeFileSync(join(dir, "planner", "package.json"), "{}");
    mkdirSync(join(dir, "lab"));
    writeFileSync(join(dir, "lab", "package.json"), "{}");

    const result = discoverExtensionPackages(dir);
    expect(result).toEqual([join(dir, "lab"), join(dir, "planner")]);
  });

  test("includes folders without package.json so validation can report diagnostics", () => {
    const dir = createTempDir();
    mkdirSync(join(dir, "broken"));
    mkdirSync(join(dir, "planner"));
    writeFileSync(join(dir, "planner", "package.json"), "{}");

    expect(discoverExtensionPackages(dir)).toEqual([join(dir, "broken"), join(dir, "planner")]);
  });
});

describe("pstdioHomeRoot", () => {
  test("respects PSTDIO_HOME override", () => {
    process.env.PSTDIO_HOME = "/custom/home";
    expect(pstdioHomeRoot()).toBe(resolve("/custom/home"));
  });

  test("falls back to $HOME/.pstdio", () => {
    delete process.env.PSTDIO_HOME;
    process.env.HOME = "/home/test";
    expect(pstdioHomeRoot()).toBe(resolve("/home/test/.pstdio"));
  });
});

describe("discoverExtensionPackagesInUserRoot", () => {
  test("uses PSTDIO_HOME/extensions when set", () => {
    const home = createTempDir();
    process.env.PSTDIO_HOME = home;
    const extensionsDir = join(home, "extensions");
    mkdirSync(extensionsDir);
    mkdirSync(join(extensionsDir, "planner"));
    writeFileSync(join(extensionsDir, "planner", "package.json"), "{}");

    expect(discoverExtensionPackagesInUserRoot()).toEqual([join(extensionsDir, "planner")]);
  });
});
