import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionImportJob } from "pstdio-api-contracts";
import { createSessionImportJobStore } from "./job-store";

test("polls durable import progress while checkpoints are replaced", async () => {
  const directory = await mkdtemp(join(tmpdir(), "import-checkpoint-polling-"));
  const store = createSessionImportJobStore(directory);
  const job: SessionImportJob = {
    id: crypto.randomUUID(),
    source: { sourcePath: directory, storagePath: directory, projectMap: {} },
    fingerprint: null,
    status: "running",
    phase: "importing",
    indexedFiles: 50,
    attempt: 1,
    cursor: 0,
    processed: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    excluded: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    await store.write(job);
    await Promise.all([
      (async () => {
        for (let cursor = 1; cursor <= 50; cursor++) await store.write({ ...job, cursor, processed: cursor });
      })(),
      (async () => {
        for (let sample = 0; sample < 150; sample++) {
          const progress = await store.read(job.id);
          expect(progress.processed).toBe(progress.cursor);
          expect(progress.cursor).toBeGreaterThanOrEqual(0);
          expect(progress.cursor).toBeLessThanOrEqual(50);
        }
      })(),
    ]);
    expect(await store.read(job.id)).toMatchObject({ cursor: 50, processed: 50 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
