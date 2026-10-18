import { readFileSync } from "node:fs";

// `kill(pid, 0)` also succeeds for a zombie: a process that exited but that its parent has not
// reaped. A detached runtime is adopted by PID 1, and a container without an init process may
// never reap it. A zombie holds no port, file, or lock, so it has stopped. Linux reports this
// state in /proc; other platforms reap adopted processes through their own PID 1.
const hasExited = (pid: number) => {
  if (process.platform !== "linux") return false;
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const state = stat.charAt(stat.lastIndexOf(")") + 2);
    return state === "Z" || state === "X";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }
};

export const isRuntimePidAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
  return !hasExited(pid);
};
