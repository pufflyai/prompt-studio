import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { canonicalDbPath, resolveDbPath } from "./paths";

const originalDbPath = process.env.PSTDIO_DB_PATH;
const originalPstdioHome = process.env.PSTDIO_HOME;

afterEach(() => {
  if (typeof originalDbPath === "undefined") {
    delete process.env.PSTDIO_DB_PATH;
  } else {
    process.env.PSTDIO_DB_PATH = originalDbPath;
  }

  if (typeof originalPstdioHome === "undefined") {
    delete process.env.PSTDIO_HOME;
    return;
  }

  process.env.PSTDIO_HOME = originalPstdioHome;
});

describe("resolveDbPath", () => {
  it("uses ~/.pstdio/pstdio.db by default", () => {
    delete process.env.PSTDIO_DB_PATH;
    delete process.env.PSTDIO_HOME;

    expect(resolveDbPath()).toBe(path.join(os.homedir(), ".pstdio", "pstdio.db"));
  });

  it("uses PSTDIO_HOME for the default database path", () => {
    delete process.env.PSTDIO_DB_PATH;
    process.env.PSTDIO_HOME = path.resolve("/tmp/pstdio-home");

    expect(resolveDbPath()).toBe(path.join(process.env.PSTDIO_HOME!, "pstdio.db"));
  });

  it("expands the home directory from PSTDIO_DB_PATH", () => {
    process.env.PSTDIO_DB_PATH = "~/.pstdio/custom";

    expect(resolveDbPath()).toBe(path.join(os.homedir(), ".pstdio", "custom"));
  });

  it("prefers an explicit path over PSTDIO_DB_PATH", () => {
    process.env.PSTDIO_DB_PATH = "/tmp/env-path";

    expect(resolveDbPath("~/.pstdio/explicit")).toBe(path.join(os.homedir(), ".pstdio", "explicit"));
  });
});

describe("canonicalDbPath", () => {
  it("creates only the parent so recovery can inspect an absent active home", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-db-"));
    const dbPath = path.join(tempRoot, "nested", ".pstdio");

    expect(canonicalDbPath(dbPath)).toBe(path.join(fs.realpathSync(path.dirname(dbPath)), ".pstdio"));
    expect(fs.existsSync(dbPath)).toBe(false);

    fs.rmSync(tempRoot, { force: true, recursive: true });
  });

  it("skips directory creation for in-memory databases", () => {
    expect(canonicalDbPath(":memory:")).toBe(":memory:");
  });
});
