import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFilesystemRoutes } from "../routes";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const request = (parent_path: string, name: string) =>
  createFilesystemRoutes({}).request("/filesystem/directories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parent_path, name }),
  });

test("creates a child folder and returns its canonical path", async () => {
  const root = mkdtempSync(join(tmpdir(), "new-folder-"));
  roots.push(root);
  const alias = `${root}-alias`;
  roots.push(alias);
  symlinkSync(root, alias);
  const response = await request(alias, "2026 笔记");
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ path: join(await realpath(root), "2026 笔记") });
  expect(existsSync(join(root, "2026 笔记"))).toBe(true);
  expect((await request(root, "2026 笔记")).status).toBe(409);
});

test("rejects names that escape the selected parent and missing parents", async () => {
  const root = mkdtempSync(join(tmpdir(), "new-folder-"));
  roots.push(root);
  for (const name of ["", ".", "..", "../escape", "a/b", "a\\b", "/tmp/escape", "bad\u0000name"]) {
    expect((await request(root, name)).status).toBe(400);
  }
  expect((await request(join(root, "missing"), "child")).status).toBe(400);
});

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "reports a parent permission failure without creating a child",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "readonly-folder-"));
    roots.push(root);
    const { chmodSync } = await import("node:fs");
    chmodSync(root, 0o500);
    try {
      expect((await request(root, "child")).status).toBe(400);
      expect(existsSync(join(root, "child"))).toBe(false);
    } finally {
      chmodSync(root, 0o700);
    }
  },
);
