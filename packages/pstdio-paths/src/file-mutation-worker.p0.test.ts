import { expect, test } from "bun:test";
import { existsSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { Worker } from "node:worker_threads";
import { fileMutationWorkerMarker, registerFileMutationWorker } from "./file-mutation-worker";

test("worker ownership markers are private to the user and retire with their worker", async () => {
  const worker = new Worker(new URL("./file-mutation-worker.fixture.ts", import.meta.url));
  const marker = fileMutationWorkerMarker(process.pid, worker.threadId);
  const release = registerFileMutationWorker(worker);
  try {
    const observed = await new Promise<string>((resolve, reject) => {
      worker.once("message", resolve);
      worker.once("error", reject);
    });
    expect(observed).toBe(marker);
    expect(existsSync(marker)).toBe(true);
    if (process.platform !== "win32") expect(statSync(dirname(marker)).mode & 0o077).toBe(0);
    await worker.terminate();
    expect(existsSync(marker)).toBe(false);
  } finally {
    await worker.terminate();
    release();
  }
});
