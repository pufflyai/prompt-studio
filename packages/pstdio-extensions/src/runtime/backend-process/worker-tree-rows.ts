import { dlopen } from "bun:ffi";
import { execFile } from "node:child_process";
import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import { promisify } from "node:util";

export type ProcessEntry = {
  pid: number;
  parent: number;
  group: number;
  state: string;
  started: string;
  threads?: number;
};

const run = promisify(execFile);
export const timeLeft = (deadline: number) => Math.ceil(deadline - performance.now());
export const unfinished = () => new Error("The extension backend worker process tree did not stop.");

const checkLinuxNamespace = () => {
  if (Number(readlinkSync("/proc/self")) !== process.pid)
    throw new Error("The extension backend process table is outside the host PID namespace.");
};

const readProc = <Value>(read: () => Value) => {
  try {
    return read();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ESRCH" || code === "EPERM" || code === "EACCES") return;
    throw error;
  }
};

const linuxProcesses = (deadline: number, pids?: number[]) => {
  checkLinuxNamespace();
  return (pids ?? readdirSync("/proc").filter((entry) => /^\d+$/.test(entry))).flatMap((pid) => {
    if (timeLeft(deadline) <= 0) throw unfinished();
    const stat = readProc(() => readFileSync(`/proc/${pid}/stat`, "utf8"));
    if (!stat) return [];
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ", 20);
    const [state, parent, group] = fields;
    // procfs start time is counted in ticks and distinguishes reused PIDs.
    const started = fields[19];
    if (!state || !started) return [];
    return [
      { pid: Number(pid), parent: Number(parent), group: Number(group), state, started, threads: Number(fields[17]) },
    ];
  });
};

export const readProcesses = async (deadline: number, pids?: number[]): Promise<ProcessEntry[]> => {
  if (pids?.length === 0) return [];
  if (process.platform === "linux") return linuxProcesses(deadline, pids);
  const timeout = timeLeft(deadline);
  if (timeout <= 0) throw unfinished();
  const selection = pids ? ["-p", pids.join(",")] : ["-A"];
  const { stdout } = await run("ps", [...selection, "-o", "pid=,ppid=,pgid=,stat=,lstart="], { timeout }).catch(
    (error) => {
      // A targeted Darwin ps exits 1 when every requested PID disappeared.
      if (pids && error.code === 1 && !error.stderr) return { stdout: error.stdout as string };
      throw error;
    },
  );
  return stdout.split("\n").flatMap((line) => {
    const row = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
    if (!row) return [];
    const [, pid, parent, group, state, started] = row;
    return [{ pid: Number(pid), parent: Number(parent), group: Number(group), state, started }];
  });
};

const readLinuxChildren = (pid: number, deadline: number) => {
  checkLinuxNamespace();
  const tasks = readProc(() => readdirSync(`/proc/${pid}/task`)) ?? [];
  // A child is listed under the task that forked it, which need not be the process leader.
  return tasks.flatMap((tid) => {
    if (timeLeft(deadline) <= 0) throw unfinished();
    const children = readProc(() => readFileSync(`/proc/${pid}/task/${tid}/children`, "utf8")) ?? "";
    return children.trim().split(/\s+/).filter(Boolean).map(Number);
  });
};

const loadDarwinProcessList = () =>
  dlopen("/usr/lib/libproc.dylib", { proc_listchildpids: { args: ["i32", "ptr", "i32"], returns: "i32" } });
let darwinProcessList: ReturnType<typeof loadDarwinProcessList> | undefined;

const readDarwinChildren = (pid: number, deadline: number) => {
  darwinProcessList ??= loadDarwinProcessList();
  const { proc_listchildpids } = darwinProcessList.symbols;
  // libproc returns the PID count. A full buffer may omit children.
  for (let capacity = 16; timeLeft(deadline) > 0; capacity *= 2) {
    const children = new Int32Array(capacity);
    const count = proc_listchildpids(pid, children, children.byteLength);
    if (count <= 0) return [];
    if (count < capacity) return Array.from(children.subarray(0, count));
  }
  throw unfinished();
};

export const readDirectChildren = (pid: number, deadline: number) =>
  process.platform === "linux" ? readLinuxChildren(pid, deadline) : readDarwinChildren(pid, deadline);
