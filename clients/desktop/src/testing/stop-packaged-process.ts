import { type ChildProcess, execFile } from "node:child_process";

// Ends the process tree and returns the IDs of processes the kill could not end.
type KillTree = (pid: number) => Promise<number[]>;

const killTree: KillTree = (pid) => {
  if (process.platform !== "win32") {
    try {
      process.kill(-pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    return Promise.resolve([]);
  }
  return new Promise((resolve, reject) => {
    execFile("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, (error, stdout, stderr) => {
      if (!error) return resolve([]);
      // 128: the process had already exited.
      if (error.code === 128) return resolve([]);
      // taskkill names every process it could not end, for example one that is already exiting.
      const refused = [...`${stdout}${stderr}`.matchAll(/process with PID (\d+)/g)].map((match) => Number(match[1]));
      if (refused.length > 0) resolve(refused);
      else reject(error);
    });
  });
};

const isRunning = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

// The stop is done once the app exits and every process the kill refused has ended too.
export const stopPackagedProcess = async (child: ChildProcess, kill: KillTree = killTree) => {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
  const refused = await kill(child.pid);
  await exited;
  const survivors = refused.filter(isRunning);
  if (survivors.length > 0)
    throw new Error(`Stopping the packaged app left processes running: ${survivors.join(", ")}`);
};
