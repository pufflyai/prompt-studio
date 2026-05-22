import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveApiFilesRoot } from "./default-files-root";

test("resolveApiFilesRoot prefers an explicit env override", () => {
  expect(resolveApiFilesRoot({ PSTDIO_FILES_ROOT: "/tmp/pstdio-files" })).toBe("/tmp/pstdio-files");
});

test("resolveApiFilesRoot derives the workspace files root by default", () => {
  const filesRoot = join(import.meta.dir, "..", "..", "pstdio", "files");

  expect(resolveApiFilesRoot({})).toBe(existsSync(filesRoot) ? filesRoot : "");
});
