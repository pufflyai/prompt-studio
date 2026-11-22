import { mock } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolate injection from all other database/filesystem tests in a Bun child.
const actual = await import("../../db/pglite-home-recovery");
const flush = actual.flushDirectory;
const root = await realpath(await mkdtemp(join(tmpdir(), "document-directory-durability-")));
const database = join(root, "database");
const folder = `${database}-documents`;
const project = join(folder, "p-70726f6a656374");
const leaf = join(project, "1");
const bytes = new Uint8Array([2, 0, 255]);
const file = join(leaf, `state-${createHash("sha256").update(bytes).digest("hex")}.bin`);
const mode = process.argv[2];
const calls: string[] = [];
let active = false;
let failed = false;
let entered!: () => void;
let release!: () => void;
let failureObserved!: () => void;
let secondCreated!: () => void;
const second = new Promise<void>((resolve) => {
  secondCreated = resolve;
});
const failure = new Promise<void>((resolve) => {
  failureObserved = resolve;
});
const blocked = new Promise<void>((resolve) => {
  entered = resolve;
});
const released = new Promise<void>((resolve) => {
  release = resolve;
});
mock.module("../../db/pglite-home-recovery", () => ({
  ...actual,
  flushDirectory: async (path: string) => {
    calls.push(path);
    if (mode === "ancestry" && path === project)
      assert(existsSync(leaf), "Batch ancestry must flush after every child mkdir has settled");
    if (mode === "batch" && path === join(project, "2") && existsSync(join(project, "2", file.slice(leaf.length + 1))))
      await failure;
    const stops =
      mode === "mkdir" ? path === project && existsSync(join(project, "2")) : path === leaf && existsSync(file);
    if (active && !failed && stops) {
      failed = true;
      failureObserved();
      if (mode === "concurrent") {
        entered();
        await released;
      }
      throw new Error("interrupted document directory flush");
    }
    if (
      active &&
      failed &&
      (mode === "rollback" || mode === "batch") &&
      path === join(project, "2") &&
      existsSync(join(project, "2", file.slice(leaf.length + 1)))
    ) {
      entered();
      await released;
    }
    await flush(path);
  },
}));
if (mode === "ancestry") {
  const fs = await import("node:fs/promises");
  const actualMkdir = mkdir;
  mock.module("node:fs/promises", () => ({
    ...fs,
    mkdir: async (path: string, options: Parameters<typeof mkdir>[1]) => {
      if (path === leaf) {
        const created = await actualMkdir(folder, { recursive: true });
        entered();
        await released;
        await actualMkdir(path, options);
        return created;
      }
      const created = await actualMkdir(path, options);
      if (path === join(project, "2")) secondCreated();
      return created;
    },
  }));
}
if (mode === "collection") {
  const fs = await import("node:fs/promises");
  const actualRm = rm;
  mock.module("node:fs/promises", () => ({
    ...fs,
    rm: async (path: string, options: Parameters<typeof rm>[1]) => {
      if (active && path.startsWith(`${leaf}/`)) {
        failureObserved();
        throw new Error("interrupted document collection");
      }
      if (active && path.startsWith(`${join(project, "2")}/`)) {
        entered();
        await released;
      }
      return actualRm(path, options);
    },
  }));
}
const { createDb } = await import("../../db/connection.pglite");
const { documentFilesFor, trackDocumentFiles } = await import("./document-files");
const context = await import("./document-file-context");
const connection = await createDb({ path: database });
try {
  if (mode === "batch") assert.equal(typeof context.withDocumentFileBatch, "function");
  if (mode === "collection") {
    const { pruneDocumentFiles } = await import("./document-file-retention");
    const files = documentFilesFor(connection.db);
    await files.put("project", 1, "state", bytes);
    await files.put("project", 2, "state", bytes);
    active = true;
    const collection = pruneDocumentFiles(connection.db, "project", [1, 2]);
    const rejection = assert.rejects(collection, /interrupted document collection/);
    await blocked;
    await failure;
    const winner = await Promise.race([
      collection.then(
        () => "ended",
        () => "ended",
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve("blocked"), 50)),
    ]);
    release();
    await rejection;
    assert.equal(winner, "blocked", "Collection must drain sibling file removals before releasing its transaction");
    active = false;
    await pruneDocumentFiles(connection.db, "project", [1, 2]);
    assert(!existsSync(project), "Interrupted orphan collection must resume");
  } else {
    const transaction = connection.db.transaction(async (tx) => {
      const files = documentFilesFor(tx);
      if (mode === "ancestry") {
        await context.withDocumentFileBatch(files, [
          (writer) => writer.put("project", 1, "state", bytes),
          async (writer) => {
            await blocked;
            return writer.put("project", 2, "state", bytes);
          },
        ]);
        return;
      }
      if (mode === "reentrant") {
        for (const nested of [
          () => files.put("project", 1, "state", bytes),
          () => context.withDocumentFileBatch(files, [(writer) => writer.put("project", 1, "state", bytes)]),
          () => tx.transaction(async () => undefined),
          () => connection.db.transaction(async () => undefined),
        ]) {
          const result = await Promise.race([
            context.withDocumentFileBatch(files, [async () => nested()]).then(
              () => "accepted",
              (error: Error) => error.message,
            ),
            new Promise<string>((resolve) => setTimeout(() => resolve("hung"), 100)),
          ]);
          if (result === "hung") process.exit(2);
          assert.match(result, /must use their supplied writer/);
        }
        let escaped: typeof files | undefined;
        await context.withDocumentFileBatch(files, [
          async (writer) => {
            escaped = writer;
            // Even an unawaited immutable write must settle before the batch fence.
            void writer.put("project", 1, "state", bytes);
          },
        ]);
        assert.throws(() => escaped!.put("project", 2, "state", bytes), /writer has expired/);
        return;
      }
      await files.put("project", 1, "state", new Uint8Array([1]));
      active = true;
      if (mode === "rollback" || mode === "batch") {
        trackDocumentFiles(tx, "project", 1);
        trackDocumentFiles(tx, "project", 2);
        if (mode === "batch")
          await context.withDocumentFileBatch(files, [
            (writer) => writer.put("project", 1, "state", bytes),
            (writer) => writer.put("project", 2, "state", bytes),
          ]);
        else await Promise.all([files.put("project", 1, "state", bytes), files.put("project", 2, "state", bytes)]);
        return;
      }
      const id = mode === "mkdir" ? 2 : 1;
      const attempt = files.put("project", id, "state", bytes);
      const rejected = assert.rejects(attempt, /interrupted document directory flush/);
      if (mode === "concurrent") {
        await blocked;
        const mutable = bytes.slice();
        const reuse = files.put("project", 1, "state", mutable);
        mutable.fill(9);
        const winner = await Promise.race([
          reuse.then(() => "returned"),
          new Promise<string>((resolve) => setTimeout(() => resolve("blocked"), 50)),
        ]);
        release();
        await rejected;
        assert.equal(winner, "blocked", "Concurrent reuse must wait for the publishing writer's directory flush");
        const reference = await reuse;
        assert.deepEqual(await files.read("project", 1, "state", reference), bytes);
      } else {
        await rejected;
        calls.length = 0;
        const reference = await files.put("project", id, "state", bytes);
        assert.deepEqual(await files.read("project", id, "state", reference), bytes);
        for (const parent of [root, folder, project, join(project, String(id))])
          assert(calls.includes(parent), `Retry must flush ${parent}`);
      }
      assert(failed, "The intended filesystem publication must be interrupted");
    });
    if (mode === "ancestry") {
      await blocked;
      await second;
      release();
      await transaction;
      assert(calls.includes(project), "The completed batch must flush its shared parent");
    } else if (mode === "rollback" || mode === "batch") {
      const rejection = assert.rejects(transaction, /interrupted document directory flush/);
      await blocked;
      const winner = await Promise.race([
        transaction.then(
          () => "ended",
          () => "ended",
        ),
        new Promise<string>((resolve) => setTimeout(() => resolve("blocked"), 50)),
      ]);
      release();
      await rejection;
      assert.equal(winner, "blocked", "Rollback must wait for queued file publications before collection");
      assert(!existsSync(project), "Rollback collection must leave no queued orphan files");
    } else await transaction;
  }
  console.log(JSON.stringify({ mode, verified: true }));
} finally {
  release();
  await connection.close();
  await rm(root, { recursive: true, force: true });
}
