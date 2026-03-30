import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFilesStorageService } from "./files";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots.length = 0;
});

test("writeFile creates project directory and writes data", () => {
  const storageRoot = mkdtempSync(join(tmpdir(), "pstdio-files-"));
  roots.push(storageRoot);

  const service = createFilesStorageService(storageRoot);
  const projectId = "proj-1";
  const fileId = "file-1";
  const data = Buffer.from("hello world");

  const storagePath = service.writeFile(projectId, fileId, data);

  expect(readFileSync(storagePath, "utf8")).toBe("hello world");
  expect(storagePath).toBe(join(storageRoot, projectId, fileId));
});

test("deleteFile removes the file from disk", () => {
  const storageRoot = mkdtempSync(join(tmpdir(), "pstdio-files-"));
  roots.push(storageRoot);

  const service = createFilesStorageService(storageRoot);
  const storagePath = service.writeFile("proj-1", "file-1", Buffer.from("data"));

  expect(existsSync(storagePath)).toBe(true);

  service.deleteFile(storagePath);

  expect(existsSync(storagePath)).toBe(false);
});

test("deleteFile is a no-op when file does not exist", () => {
  const storageRoot = mkdtempSync(join(tmpdir(), "pstdio-files-"));
  roots.push(storageRoot);

  const service = createFilesStorageService(storageRoot);

  // Should not throw
  service.deleteFile(join(storageRoot, "nonexistent"));
});

test("removeProjectStorage removes the entire project directory", () => {
  const storageRoot = mkdtempSync(join(tmpdir(), "pstdio-files-"));
  roots.push(storageRoot);

  const service = createFilesStorageService(storageRoot);
  service.writeFile("proj-1", "file-1", Buffer.from("a"));
  service.writeFile("proj-1", "file-2", Buffer.from("b"));

  const projectDir = join(storageRoot, "proj-1");
  expect(existsSync(projectDir)).toBe(true);

  service.removeProjectStorage("proj-1");

  expect(existsSync(projectDir)).toBe(false);
});

test("computeHash returns a consistent sha256 hex digest", () => {
  const storageRoot = mkdtempSync(join(tmpdir(), "pstdio-files-"));
  roots.push(storageRoot);

  const service = createFilesStorageService(storageRoot);
  const data = Buffer.from("hello world");

  const hash1 = service.computeHash(data);
  const hash2 = service.computeHash(data);

  expect(hash1).toBe(hash2);
  expect(hash1).toHaveLength(64);
});
