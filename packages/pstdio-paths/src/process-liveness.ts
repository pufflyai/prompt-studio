import { readdirSync, readFileSync } from "node:fs";

const readLinuxStatFields = (pid: number | string) => {
  const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
  return stat.slice(stat.lastIndexOf(")") + 2).split(" ", 18);
};

const isExitedState = (state: string | undefined) => state === "Z" || state === "X";

// `kill(pid, 0)` also succeeds for a zombie: a process that exited but that its parent has not
// reaped. A detached runtime is adopted by PID 1, and a container without an init process may
// never reap it. A zombie holds no port, file, or lock, so it has stopped. Linux reports this
// state in /proc; other platforms reap adopted processes through their own PID 1.
const hasExited = (pid: number) => {
  if (process.platform !== "linux") return false;
  try {
    return isExitedState(readLinuxStatFields(pid)[0]);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }
};

export const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
  return !hasExited(pid);
};

const readLinuxProcessIds = () => readdirSync("/proc").filter((entry) => /^[1-9]\d*$/.test(entry));

const hasVisibleLinuxProcessTable = () => {
  const status = readFileSync("/proc/self/status", "utf8");
  if (!status.split("\n").some((line) => /^NSpid:\s+\d+$/.test(line) && Number(line.slice(6)) === process.pid)) {
    return false;
  }
  const mounts = readFileSync("/proc/self/mountinfo", "utf8")
    .split("\n")
    .map((line) => line.split(" - "))
    .filter(([mount]) => mount?.split(" ")[4] === "/proc");
  if (mounts.length !== 1) return false;
  const [[mount, filesystem]] = mounts;
  const [type, , options] = filesystem?.split(" ") ?? [];
  if (mount?.split(" ")[3] !== "/" || type !== "proc" || !options) return false;
  return options.split(",").every((option) => !option.startsWith("hidepid=") || /^hidepid=(0|off)$/.test(option));
};

const linuxGroupHasOnlyExitedProcesses = (group: number) => {
  try {
    const seenPids = new Set(readLinuxProcessIds());
    let foundExitedProcess = false;
    for (const pid of seenPids) {
      let fields: string[];
      try {
        fields = readLinuxStatFields(pid);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        return false;
      }
      const memberGroup = Number(fields[2]);
      if (!Number.isSafeInteger(memberGroup)) return false;
      if (memberGroup !== group) continue;
      // A zombie thread-group leader can still have siblings executing in the group.
      if (!isExitedState(fields[0]) || Number(fields[17]) !== 1) return false;
      foundExitedProcess = true;
    }
    // Procfs may hide members. A process may also fork after the first directory read.
    return (
      foundExitedProcess && hasVisibleLinuxProcessTable() && readLinuxProcessIds().every((pid) => seenPids.has(pid))
    );
  } catch {
    return false;
  }
};

export const isProcessGroupAlive = (group: number) => {
  try {
    process.kill(-group, 0);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return process.platform === "linux" ? code !== "ESRCH" : code === "EPERM";
  }
  return process.platform !== "linux" || !linuxGroupHasOnlyExitedProcesses(group);
};
