interface SignalableChild {
  pid: number;
  kill(signal?: NodeJS.Signals): void;
}

/**
 * Stops a child and everything it started. A child that leads its own process group — spawned
 * with `detached`, or attached to a PTY — is reached through the group, which is the only way
 * to catch grandchildren the host never saw. Windows force-stops the tree with taskkill.
 * Falls back to the child alone when the group is already gone or cannot be reached.
 */
export const signalProcessTree = (child: SignalableChild, signal: NodeJS.Signals) => {
  if (process.platform === "win32" && signal === "SIGKILL") {
    // Killing cmd.exe alone leaves the CLI inside an npm wrapper running.
    // /T includes descendants; /F is required for a timed-out console process.
    try {
      Bun.spawnSync(["taskkill.exe", "/PID", String(child.pid), "/T", "/F"], {
        stdout: "ignore",
        stderr: "ignore",
        windowsHide: true,
      });
    } catch {}
    try {
      child.kill(signal);
    } catch {}
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
