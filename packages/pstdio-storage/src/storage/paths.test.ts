import { expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import { resolveStorageRoot } from "./paths";

test("resolveStorageRoot requires an explicit storage path", () => {
  expect(() => resolveStorageRoot()).toThrow("Storage path is required. Set PSTDIO_STORAGE_PATH or pass storagePath.");
});

test("resolveStorageRoot expands ~ to home directory", () => {
  expect(resolveStorageRoot("~/.pstdio/storage")).toBe(path.join(os.homedir(), ".pstdio", "storage"));
});

test("resolveStorageRoot returns absolute paths as-is", () => {
  expect(resolveStorageRoot("/tmp/storage")).toBe("/tmp/storage");
});
