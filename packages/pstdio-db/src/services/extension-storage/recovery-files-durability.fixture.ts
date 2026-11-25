import { mock } from "bun:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Run in a child so a failed filesystem operation cannot replace another test's filesystem boundary.
const actual = await import("../../db/pglite-home-recovery");
const flush = actual.flushDirectory;
const root = await mkdtemp(join(tmpdir(), "recovery-directory-durability-"));
const folder = join(root, "new", "custom", "database-recovery");
const slot = join(folder, "p-70726f6a656374", "24");
const calls: string[] = [];
let fail = true;
let file = "";
mock.module("../../db/pglite-home-recovery", () => ({
  ...actual,
  flushDirectory: async (path: string) => {
    calls.push(path);
    const stop = process.argv[2] === "rename" ? path === slot && existsSync(file) : path === root;
    if (fail && stop) {
      fail = false;
      throw new Error("interrupted directory flush");
    }
    await flush(path);
  },
}));
try {
  const { createRecoveryFiles, prepareRecoveryBytes } = await import("./recovery-files");
  const files = createRecoveryFiles(folder);
  const content = await prepareRecoveryBytes({ records: new Uint8Array([1, 2, 3]), metadata: new Uint8Array([4, 5]) });
  file = join(slot, `${content.sha256}.json.gz`);
  await assert.rejects(files.put("project", 24, content), /interrupted directory flush/);
  assert.equal(existsSync(file), process.argv[2] === "rename");
  calls.length = 0;
  const reference = await files.put("project", 24, content);
  assert.deepEqual(await files.read("project", 24, reference), {
    records: Buffer.from([1, 2, 3]),
    metadata: Buffer.from([4, 5]),
  });
  const parents = [root, join(root, "new"), join(root, "new", "custom"), folder, dirname(slot), slot];
  for (const parent of parents) assert(calls.includes(parent), `The successful retry must flush ${parent}`);
  console.log(JSON.stringify({ interruptedAfter: process.argv[2], verified: true, flushedParents: parents.length }));
} finally {
  await rm(root, { recursive: true, force: true });
}
