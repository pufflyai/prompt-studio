import { afterEach, expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import { resolveStorageRoot } from "./paths";

const originalPstdioHome = process.env.PSTDIO_HOME;

afterEach(() => {
  if (originalPstdioHome === undefined) {
    delete process.env.PSTDIO_HOME;
    return;
  }

  process.env.PSTDIO_HOME = originalPstdioHome;
});

test("resolveStorageRoot uses ~/.pstdio/storage by default", () => {
  delete process.env.PSTDIO_HOME;

  expect(resolveStorageRoot()).toBe(path.join(os.homedir(), ".pstdio", "storage"));
});

test("resolveStorageRoot uses PSTDIO_HOME by default", () => {
  process.env.PSTDIO_HOME = "/tmp/pstdio-home";

  expect(resolveStorageRoot()).toBe("/tmp/pstdio-home/storage");
});

test("resolveStorageRoot expands ~ to home directory", () => {
  expect(resolveStorageRoot("~/.pstdio/storage")).toBe(path.join(os.homedir(), ".pstdio", "storage"));
});

test("resolveStorageRoot returns absolute paths as-is", () => {
  expect(resolveStorageRoot("/tmp/storage")).toBe("/tmp/storage");
});
