import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import { threadId, type Worker } from "node:worker_threads";
import { isProcessAlive } from "./process-liveness";

// Markers must be shared by this user's runtimes even when PSTDIO_HOME differs.
// The account home is trusted; another user can pre-create names in shared tmp.
const markerDirectory = () => join(userInfo().homedir, ".pstdio", "file-lock-workers");
export const fileMutationWorkerMarker = (pid: number, id: number) => join(markerDirectory(), `${pid}-${id}`);
const markerPath = (id: number) => fileMutationWorkerMarker(process.pid, id);
// The host creates this before admitting jobs and removes it only after the worker exits.
// Claims from a forcibly terminated thread must not look alive merely because its app is alive.
export const registerFileMutationWorker = (worker: Worker) => {
  const path = markerPath(worker.threadId);
  mkdirSync(markerDirectory(), { recursive: true, mode: 0o700 });
  writeFileSync(path, "alive");
  const release = () => rmSync(path, { force: true });
  worker.once("exit", release);
  return release;
};
export const currentFileMutationWorker = () => {
  const path = markerPath(threadId);
  return threadId !== 0 && existsSync(path) ? path : undefined;
};

// Missing legacy markers retain work conservatively until its process exits.
// Registered workers have a marker whose removal distinguishes retirement from
// another live thread in the same process.
export const isFileMutationOwnerAlive = (owner: { pid: number; worker?: string }) =>
  isProcessAlive(owner.pid) && (owner.worker === undefined || existsSync(owner.worker));
