import { rmSync } from "node:fs";
import { stopWindowsProcessTree } from "../preparation-windows-process-tree";

type WorkerProcess = { pid: number; exited: Promise<unknown>; kill(signal: NodeJS.Signals): void };

const STOP_GRACE_MS = 2_000;
const STOP_TIMEOUT_MS = 10_000;

export const spawnWorker = (
  options: { command: string[]; env: Record<string, string | undefined> },
  cwd: string,
  receive: (raw: unknown) => void,
  onDisconnect: () => void,
) => {
  try {
    return Bun.spawn(options.command, {
      cwd,
      env: options.env,
      stdio: ["ignore", "inherit", "inherit"],
      serialization: "advanced",
      ipc: receive,
      // Its own process group, so processes extension code starts stop with it.
      detached: process.platform !== "win32",
      onDisconnect,
    });
  } catch (error) {
    // Nothing started, so nothing else will remove the working folder.
    rmSync(cwd, { recursive: true, force: true });
    throw error;
  }
};

const signalGroup = (child: WorkerProcess, signal: NodeJS.Signals) => {
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
};

const sweepWorkerGroup = (pid: number) => {
  if (process.platform === "win32") return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {}
};

/** Explicit stop, IPC disconnect and watchdog termination all own the same shutdown. */
export const createWorkerTreeStop = (child: WorkerProcess) => {
  let rootExited = false;
  let stopping: Promise<void> | undefined;
  const swept = child.exited.then(() => {
    rootExited = true;
    // Unix retains the process group after its leader crashes. Windows loses the tree with its root.
    sweepWorkerGroup(child.pid);
  });
  const report = (error: unknown) => {
    console.warn("[pstdio-extensions] Could not stop extension backend worker process tree", error);
  };

  const terminate = async (signal: NodeJS.Signals) => {
    if (rootExited) return swept;

    let force: ReturnType<typeof setTimeout> | undefined;
    const timedOut = Promise.withResolvers<never>();
    const deadline = setTimeout(
      () => timedOut.reject(new Error("Stopping the extension backend worker timed out.")),
      STOP_TIMEOUT_MS,
    );

    try {
      if (process.platform === "win32") {
        await Promise.race([stopWindowsProcessTree(child), timedOut.promise]);
      } else {
        signalGroup(child, signal);
        if (signal === "SIGTERM") {
          force = setTimeout(() => {
            if (rootExited) return;
            try {
              signalGroup(child, "SIGKILL");
            } catch (error) {
              timedOut.reject(error);
            }
          }, STOP_GRACE_MS);
        }
        await Promise.race([swept, timedOut.promise]);
      }
    } finally {
      clearTimeout(force);
      clearTimeout(deadline);
    }
  };

  return (signal: NodeJS.Signals) => {
    if (!stopping) {
      stopping = terminate(signal);
      void stopping.catch(report);
    }
    return stopping;
  };
};
