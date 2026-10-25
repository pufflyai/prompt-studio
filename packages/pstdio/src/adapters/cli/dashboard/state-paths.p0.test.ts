import { afterEach, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { resolveDefaultDbPath, resolveDefaultStoragePath } from "./state-paths";

const DATA_DIR = join(homedir(), ".pstdio");
const originalHome = process.env.HOME;
const originalPstdioHome = process.env.PSTDIO_HOME;

afterEach(() => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }

  if (originalPstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
    return;
  }

  process.env.PSTDIO_HOME = originalPstdioHome;
});

test("resolveDefaultDbPath returns path inside ~/.pstdio", () => {
  process.env.HOME = homedir();
  delete process.env.PSTDIO_HOME;

  expect(resolveDefaultDbPath()).toBe(join(DATA_DIR, "pstdio.db"));
});

test("resolveDefaultStoragePath returns path inside ~/.pstdio", () => {
  process.env.HOME = homedir();
  delete process.env.PSTDIO_HOME;

  expect(resolveDefaultStoragePath()).toBe(join(DATA_DIR, "storage"));
});

test("default state paths derive from PSTDIO_HOME when set", () => {
  process.env.PSTDIO_HOME = "/tmp/pstdio-dev-home";
  const devHome = resolve("/tmp/pstdio-dev-home");

  expect(resolveDefaultDbPath()).toBe(join(devHome, "pstdio.db"));
  expect(resolveDefaultStoragePath()).toBe(join(devHome, "storage"));
});
