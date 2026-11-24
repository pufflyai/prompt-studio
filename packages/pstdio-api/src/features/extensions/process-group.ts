import { stopWindowsProcessTree } from "./windows-process-tree";

interface SignalableChild {
  pid: number;
  exited: Promise<unknown>;
  kill(signal?: NodeJS.Signals): void;
}

/**
 * Stops a child and everything it started. A child that leads its own process group — spawned
 * with `detached`, or attached to a PTY — is reached through the group, which is the only way
 * to catch grandchildren the host never saw. Windows force-stops the tree with taskkill.
 * Falls back to the child alone when the group is already gone or cannot be reached.
 */
export const signalProcessTree = async (child: SignalableChild, signal: NodeJS.Signals) => {
  if (process.platform === "win32" && signal === "SIGKILL") {
    // Killing cmd.exe alone leaves the CLI inside an npm wrapper running.
    // /T includes descendants; /F is required for a timed-out console process.
    await stopWindowsProcessTree(child);
    return;
  }
  try {
    process.kill(-child.pid, signal);
    return;
  } catch {
    try {
      child.kill(signal);
    } catch {}
  }
};

const groupAlive = (pid: number) => {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Resolves true when the child and, outside Windows, every process left in its group exited inside
 * the budget. A shell can exit on SIGTERM while a grandchild that ignores it keeps running.
 */
export const treeExitedWithin = async (child: SignalableChild, timeoutMs: number) => {
  const deadline = performance.now() + timeoutMs;
  if (!(await exitedWithin(child.exited, timeoutMs))) return false;
  if (process.platform === "win32") return true;
  while (groupAlive(child.pid)) {
    if (performance.now() >= deadline) return false;
    await Bun.sleep(25);
  }
  return true;
};

/** Resolves true when the process exited inside the budget, false when the budget ran out. */
export const exitedWithin = async (exited: Promise<unknown>, timeoutMs: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const stopped = await Promise.race([exited.then(() => true), deadline]);
  clearTimeout(timer);
  return stopped;
};
