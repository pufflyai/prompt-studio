import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "./create-test-app";

test("uses caller-owned storage when the system temp directory is unavailable", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-app-storage-"));
  const storageRoot = join(root, "storage");
  mkdirSync(storageRoot);
  const ownedFile = join(storageRoot, "caller-owned.txt");
  writeFileSync(ownedFile, "preserve caller data");
  const previousTempDir = process.env.TMPDIR;
  process.env.TMPDIR = join(root, "unavailable");
  let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;
  try {
    handle = await createTestApp({ storageRoot });
    const response = await handle.app.request("/v1/projects");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    await handle.close();
    handle = undefined;
    expect(readFileSync(ownedFile, "utf8")).toBe("preserve caller data");
  } finally {
    if (previousTempDir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previousTempDir;
    await handle?.close();
    rmSync(root, { recursive: true, force: true });
  }
});
