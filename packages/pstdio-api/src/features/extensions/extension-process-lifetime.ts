import { apiLogger } from "../../lib/logger";
import type { ResolvedProcessCommand } from "./process-command";
import type { ProcessEnvironmentLease } from "./process-environment/permissions";
import { PROCESS_STOP_TIMEOUT_MS, processGroupExited, signalProcessTree, treeExitedWithin } from "./process-group";
import { startWindowsGrantedProcess } from "./windows-granted-process";

type ChildInput = {
  spawner: typeof Bun.spawn;
  command: ResolvedProcessCommand;
  cwd?: string;
  env: NodeJS.ProcessEnv;
  detached: boolean;
  trackTree: boolean;
  stdin?: "pipe";
};

const launchChild = (input: ChildInput) => {
  if (process.platform === "win32" && input.trackTree)
    return startWindowsGrantedProcess({ ...input, stopTimeoutMs: PROCESS_STOP_TIMEOUT_MS });

  const output = input.detached ? "ignore" : "pipe";
  const child = input.spawner(input.command.argv, {
    cwd: input.cwd,
    // Windows detachment breaks captured output from commands inside npm shims.
    detached: input.detached || process.platform !== "win32",
    env: input.env,
    stdin: input.stdin ?? "ignore",
    stderr: output,
    stdout: output,
    windowsHide: true,
    windowsVerbatimArguments: input.command.windowsVerbatimArguments,
  });
  return {
    child,
    pid: Promise.resolve(child.pid),
    exited: child.exited,
    treeExited: input.trackTree ? processGroupExited(child) : undefined,
    async stop() {
      await signalProcessTree(child, "SIGKILL");
      if (input.trackTree && !(await treeExitedWithin(child, PROCESS_STOP_TIMEOUT_MS)))
        throw new Error(`The granted process group ${child.pid} did not exit after being stopped.`);
      await child.exited;
    },
  };
};

export const startProcessChild = (input: ChildInput) => {
  const started = launchChild(input);
  let stopping: Promise<void> | undefined;
  return {
    ...started,
    stop() {
      // Revoke, cancellation and timeout may all target the same tree. A later revoke can
      // retry an earlier failed stop, while simultaneous callers share the same attempt.
      if (!stopping) {
        stopping = started.stop();
        stopping.catch(() => {
          stopping = undefined;
        });
      }
      return stopping;
    },
  };
};

export const watchLease = (treeExited: Promise<void> | undefined, lease?: ProcessEnvironmentLease) => {
  if (!treeExited || !lease) return;
  void treeExited.then(lease.release, (error: unknown) => {
    apiLogger.warn(
      { err: error, event: "extension.process.grant_tracking_failed" },
      "Could not verify granted process exit",
    );
  });
};
