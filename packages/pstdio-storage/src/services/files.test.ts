import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveFileStoragePath } from "../storage/paths";
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

test("opaque workbench and file identities cannot alias another owner's bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-files-"));
  roots.push(root);
  const storage = createFilesStorageService(root);
  const first = storage.writeFile("a/../b", "same", Buffer.from("first owner"));
  const second = storage.writeFile("b", "same", Buffer.from("second owner"));
  const third = storage.writeFile("b", "sub/../same", Buffer.from("another file"));
  expect(readFileSync(first, "utf8")).toBe("first owner");
  expect(readFileSync(second, "utf8")).toBe("second owner");
  expect(readFileSync(third, "utf8")).toBe("another file");
});

test("legacy file uploads persist one chunk before requesting the next and return verified metadata", async () => {
  const storageRoot = mkdtempSync(join(tmpdir(), "pstdio-files-"));
  roots.push(storageRoot);
  const service = createFilesStorageService(storageRoot);
  let chunks = 0;
  const data = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (chunks++ === 0) controller.enqueue(new TextEncoder().encode("first"));
        else {
          expect(readFileSync(resolveFileStoragePath(storageRoot, "project", "file"), "utf8")).toBe("first");
          controller.enqueue(new TextEncoder().encode("second"));
          controller.close();
        }
      },
    },
    { highWaterMark: 0 },
  );
  const stored = await service.writeStream("project", "file", data);
  expect(stored).toEqual({
    storagePath: resolveFileStoragePath(storageRoot, "project", "file"),
    byteLength: 11,
    hash: createHash("sha256").update("firstsecond").digest("hex"),
  });
});

test("failed legacy file streams remove temporary bytes", async () => {
  const storageRoot = mkdtempSync(join(tmpdir(), "pstdio-files-"));
  roots.push(storageRoot);
  const service = createFilesStorageService(storageRoot);
  let chunks = 0;
  const data = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (chunks++ === 0) controller.enqueue(new TextEncoder().encode("partial"));
        else controller.error(new Error("Source disconnected"));
      },
    },
    { highWaterMark: 0 },
  );
  const error = await service.writeStream("project", "file", data).catch((error: unknown) => error);
  expect(error).toBeInstanceOf(Error);
  expect(existsSync(resolveFileStoragePath(storageRoot, "project", "file"))).toBe(false);
});
