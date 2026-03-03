import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findGitRoot, readConfig, removeConfig, writeConfig } from "./config";

const tmpBase = join(import.meta.dirname, "__test-tmp__");

const setup = (name: string) => {
  const dir = join(tmpBase, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("findGitRoot", () => {
  test("finds root by .git directory", () => {
    const root = setup("git-root");
    mkdirSync(join(root, ".git"));
    const nested = join(root, "a", "b");
    mkdirSync(nested, { recursive: true });

    expect(findGitRoot(nested)).toBe(root);
  });

  test("finds git worktree root (.git file)", () => {
    const root = setup("worktree-root");
    writeFileSync(join(root, ".git"), "gitdir: /some/path");

    expect(findGitRoot(root)).toBe(root);
  });
});

describe("readConfig", () => {
  test("reads config from .pstdio/config.json", () => {
    const root = setup("read-config");
    const configDir = join(root, ".pstdio");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), JSON.stringify({ project_id: "abc-123" }));

    const config = readConfig(root);

    expect(config).toEqual({ project_id: "abc-123" });
  });

  test("returns null when config does not exist", () => {
    const root = setup("no-config");

    expect(readConfig(root)).toBeNull();
  });
});

describe("writeConfig", () => {
  test("writes config to .pstdio/config.json", () => {
    const root = setup("write-config");

    writeConfig(root, { project_id: "xyz-789" });

    const raw = readFileSync(join(root, ".pstdio", "config.json"), "utf8");
    expect(raw).toContain("xyz-789");
  });

  test("creates .pstdio directory if missing", () => {
    const root = setup("write-config-mkdir");

    writeConfig(root, { project_id: "new" });

    expect(existsSync(join(root, ".pstdio", "config.json"))).toBe(true);
  });
});

describe("removeConfig", () => {
  test("removes config.json and returns true", () => {
    const root = setup("remove-config");
    writeConfig(root, { project_id: "abc" });

    expect(removeConfig(root)).toBe(true);
    expect(existsSync(join(root, ".pstdio", "config.json"))).toBe(false);
  });

  test("returns false when config does not exist", () => {
    const root = setup("remove-config-missing");

    expect(removeConfig(root)).toBe(false);
  });
});
