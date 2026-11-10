import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { threadId, type Worker } from "node:worker_threads";

export const fileMutationWorkerMarker = (pid: number, id: number) =>
  join(tmpdir(), "pstdio-file-lock-workers", `${pid}-${id}`);
const markerPath = (id: number) => fileMutationWorkerMarker(process.pid, id);
// The host creates this before admitting jobs and removes it only after the worker exits.
// Claims from a forcibly terminated thread must not look alive merely because its app is alive.
export const registerFileMutationWorker = (worker: Worker) => {
  const path = markerPath(worker.threadId);
  mkdirSync(join(tmpdir(), "pstdio-file-lock-workers"), { recursive: true });
  writeFileSync(path, "alive");
  const release = () => rmSync(path, { force: true });
  worker.once("exit", release);
  return release;
};
export const currentFileMutationWorker = () => {
  const path = markerPath(threadId);
  return threadId !== 0 && existsSync(path) ? path : undefined;
};
