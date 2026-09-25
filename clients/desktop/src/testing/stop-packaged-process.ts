import { type ChildProcess, execFile } from "node:child_process";

export const stopPackagedProcess = async (child: ChildProcess) => {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
  try {
    if (process.platform === "win32") {
      await new Promise<void>((resolve, reject) => {
        execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, (error) => {
          const alreadyExited = child.exitCode !== null || child.signalCode !== null;
          if (error && !(error.code === 128 && alreadyExited)) reject(error);
          else resolve();
        });
      });
    } else process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  await exited;
};
