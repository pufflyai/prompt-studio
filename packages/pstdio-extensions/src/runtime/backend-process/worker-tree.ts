import { stopWindowsProcessTree } from "../preparation-windows-process-tree";

type WorkerProcess = { pid: number; exited: Promise<unknown>; kill(signal: NodeJS.Signals): void };

/**
 * Signals the worker and every process extension code started from it. On Unix the worker leads
 * its own process group; on Windows the tree is stopped by parent process id while the worker runs.
 */
export const signalWorkerTree = async (child: WorkerProcess, signal: NodeJS.Signals) => {
  if (process.platform === "win32") {
    await stopWindowsProcessTree(child).catch(() => {});
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {}
  }
};

/** Stops what the worker left behind once it has exited. Unix only: Windows loses the tree with its root. */
export const sweepWorkerGroup = (pid: number) => {
  if (process.platform === "win32") return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {}
};
