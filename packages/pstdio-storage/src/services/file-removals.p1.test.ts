import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readableFilePath } from "../storage/readable-file";
import { createFileRemovals } from "./file-removals";

for (const committed of [false, true])
  test(`replays ${committed ? "committed" : "rolled back"} file removal only for its database`, async () => {
    const root = await mkdtemp(join(tmpdir(), "file-removal-replay-"));
    try {
      const file = { id: "file", project_id: "project", owner: "example.files", storage_path: join(root, "bytes") };
      await writeFile(file.storage_path, "durable contents");
      const readable = await readableFilePath(file.storage_path, "Saved.md");
      const storageRoot = join(root, "new", "custom", "storage");
      const pending = createFileRemovals(storageRoot, "database:one");
      await pending.stage(file);
      expect(await Bun.file(file.storage_path).exists()).toBe(false);
      expect(await pending.recover(async () => file)).toEqual([]);
      expect(await Bun.file(file.storage_path).exists()).toBe(false);
      expect(await createFileRemovals(storageRoot, "database:two").recover(async () => null)).toEqual([]);
      expect(await readFile(readable, "utf8")).toBe("durable contents");

      // A fresh controller models a restarted process with no active transaction.
      const restarted = createFileRemovals(storageRoot, "database:one");
      expect(await restarted.recover(async () => (committed ? null : file))).toEqual([]);
      expect(await Bun.file(file.storage_path).exists()).toBe(!committed);
      expect(await Bun.file(readable).exists()).toBe(!committed);
      if (!committed) expect(await readFile(file.storage_path, "utf8")).toBe("durable contents");
      expect((await readdir(root)).filter((name) => name.includes(".pstdio-remove-"))).toEqual([]);
      expect(await restarted.recover(async () => (committed ? null : file))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

test("retains conflicting file paths and retries after the owning row is repaired", async () => {
  const root = await mkdtemp(join(tmpdir(), "file-removal-conflict-"));
  try {
    const file = { id: "file", project_id: "project", owner: null, storage_path: join(root, "bytes") };
    await writeFile(file.storage_path, "original");
    await createFileRemovals(root, "database:one").stage(file);
    const restarted = createFileRemovals(root, "database:one");
    expect(await restarted.recover(async () => ({ ...file, storage_path: join(root, "foreign") }))).toHaveLength(1);
    await writeFile(file.storage_path, "conflicting contents");
    expect(await restarted.recover(async () => file)).toHaveLength(1);
    expect(await readFile(file.storage_path, "utf8")).toBe("conflicting contents");
    await rm(file.storage_path);
    expect(await restarted.recover(async () => file)).toEqual([]);
    expect(await readFile(file.storage_path, "utf8")).toBe("original");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.each([
  "missing",
  "conflicting",
] as const)("concurrent recovery shares one replay with a %s source", async (source) => {
  const root = await mkdtemp(join(tmpdir(), "file-removal-concurrent-"));
  const release = Promise.withResolvers<void>();
  try {
    const file = { id: "file", project_id: "project", owner: null, storage_path: join(root, "bytes") };
    await writeFile(file.storage_path, "original");
    await createFileRemovals(root, "database:one").stage(file);
    const restarted = createFileRemovals(root, "database:one");
    if (source === "conflicting") await writeFile(file.storage_path, "conflicting contents");
    const entered = Promise.withResolvers<void>();
    const matched = Promise.withResolvers<void>();
    let lookups = 0;
    const get = async () => {
      lookups++;
      entered.resolve();
      await release.promise;
      return file;
    };
    const first = restarted.recover(get);
    await entered.promise;
    const second = restarted.recover(get, () => {
      matched.resolve();
      return true;
    });
    await matched.promise;
    release.resolve();
    const results = await Promise.all([first, second]);
    if (source === "missing") {
      expect(results).toEqual([[], []]);
      expect(await readFile(file.storage_path, "utf8")).toBe("original");
    } else {
      expect(results.map((failures) => failures.length)).toEqual([1, 1]);
      expect(await readFile(file.storage_path, "utf8")).toBe("conflicting contents");
      await rm(file.storage_path);
      expect(await restarted.recover(async () => file)).toEqual([]);
      expect(await readFile(file.storage_path, "utf8")).toBe("original");
    }
    expect(lookups).toBe(1);
  } finally {
    release.resolve();
    await rm(root, { recursive: true, force: true });
  }
});
