import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureDbDirectory, resolveDbPath } from "./paths";

const originalDbPath = process.env.PSTDIO_DB_PATH;

afterEach(() => {
  if (typeof originalDbPath === "undefined") {
    delete process.env.PSTDIO_DB_PATH;
    return;
  }

  process.env.PSTDIO_DB_PATH = originalDbPath;
});

describe("resolveDbPath", () => {
  it("uses ~/.pstdio/pstdio.db by default", () => {
    delete process.env.PSTDIO_DB_PATH;

    expect(resolveDbPath()).toBe(path.join(os.homedir(), ".pstdio", "pstdio.db"));
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

describe("ensureDbDirectory", () => {
  it("creates the database directory", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-db-"));
    const dbPath = path.join(tempRoot, "nested", ".pstdio");

    ensureDbDirectory(dbPath);

    expect(fs.existsSync(dbPath)).toBe(true);
    expect(fs.statSync(dbPath).isDirectory()).toBe(true);

    fs.rmSync(tempRoot, { force: true, recursive: true });
  });

  it("skips directory creation for in-memory databases", () => {
    expect(() => ensureDbDirectory(":memory:")).not.toThrow();
  });
});
