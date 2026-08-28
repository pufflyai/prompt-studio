import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadFilesystemAssets } from "./filesystem-assets";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

test("keys nested assets with forward slashes so request URL paths resolve", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-fs-assets-"));
  tempDirs.push(root);
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "index.html"), "<!doctype html>");
  writeFileSync(join(root, "assets", "index-abc123.js"), "export const x = 1;");

  const assets = loadFilesystemAssets(root);

  // serve-app looks these up with `new URL(request.url).pathname.slice(1)`,
  // which is always "/"-separated — so must the keys, on every platform.
  expect([...assets.keys()].sort()).toEqual(["assets/index-abc123.js", "index.html"]);
});

test("returns an empty map when the dashboard root is missing", () => {
  const missing = join(tmpdir(), "pstdio-fs-assets-missing-does-not-exist");
  expect(loadFilesystemAssets(missing).size).toBe(0);
});
