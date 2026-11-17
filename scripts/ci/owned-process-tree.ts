import { execFileSync } from "node:child_process";

interface ProcessIdentity {
  pid: number;
  parent: number;
  started: string;
}

const processTable = () => {
  const output = execFileSync("ps", ["-A", "-o", "pid=,ppid=,lstart="], {
    encoding: "utf8",
    timeout: 1000,
  });
  return output
    .trim()
    .split("\n")
    .flatMap((line) => {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
      return match ? [{ pid: Number(match[1]), parent: Number(match[2]), started: match[3]! }] : [];
    });
};

// Capture before signaling the leader: detached children otherwise get reparented.
export const ownedDescendants = (root: number) => {
  if (process.platform === "win32") return [];
  const table = processTable();
  const owned = new Set([root]);
  let count = -1;
  while (count !== owned.size) {
    count = owned.size;
    for (const entry of table) if (owned.has(entry.parent)) owned.add(entry.pid);
  }
  return table.filter((entry) => entry.pid !== root && owned.has(entry.pid));
};

export const signalDescendants = (owned: ProcessIdentity[], signal: NodeJS.Signals) => {
  if (!owned.length) return;
  // Never signal a recycled PID after the termination grace period.
  const current = new Map(processTable().map((entry) => [entry.pid, entry.started]));
  for (const entry of owned) {
    if (current.get(entry.pid) !== entry.started) continue;
    try {
      process.kill(entry.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
};
