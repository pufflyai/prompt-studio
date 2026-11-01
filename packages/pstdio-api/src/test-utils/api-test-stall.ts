import { mkdirSync, readdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// PS-1013: a stalled API test file blocked its process, and the job limit cancelled the
// shard without any record of what that process was doing. Record it before stopping it.

const output = (command: string[], timeout = 30_000) => {
  try {
    const result = Bun.spawnSync(command, { timeout, stdout: "pipe", stderr: "pipe" });
    return `${result.stdout.toString()}${result.stderr.toString()}`.trim();
  } catch (error) {
    return String(error);
  }
};

const read = (path: string) => {
  try {
    return readFileSync(path, "utf8").trim();
  } catch (error) {
    return String(error);
  }
};

const link = (path: string) => {
  try {
    return readlinkSync(path);
  } catch (error) {
    return String(error);
  }
};

const list = (path: string) => {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
};

// The runner starts a wrapper that starts `bun test`, so the stuck process is a descendant.
const processTree = (root: number) => {
  const children = new Map<number, number[]>();
  for (const line of output(["ps", "-A", "-o", "pid=,ppid="]).split("\n")) {
    const [pid, parent] = line.trim().split(/\s+/).map(Number);
    if (pid && parent) children.set(parent, [...(children.get(parent) ?? []), pid]);
  }
  const tree = [root];
  for (let index = 0; index < tree.length; index += 1) tree.push(...(children.get(tree[index]!) ?? []));
  return tree;
};

// Thread states and kernel wait channels tell a busy loop from a blocked call; native stacks
// need ptrace, which hosted Linux runners allow through passwordless sudo.
const linuxDetails = (pid: number) => [
  read(`/proc/${pid}/status`),
  "Threads (id, state, kernel wait channel):",
  ...list(`/proc/${pid}/task`).map(
    (thread) =>
      `${thread} ${read(`/proc/${pid}/task/${thread}/stat`).split(") ")[1]?.split(" ")[0]} ${read(`/proc/${pid}/task/${thread}/wchan`)}`,
  ),
  "Open files:",
  ...list(`/proc/${pid}/fd`).map((fd) => `${fd} -> ${link(`/proc/${pid}/fd/${fd}`)}`),
  "Kernel stack:",
  output(["sudo", "-n", "cat", `/proc/${pid}/stack`]),
  "Native stacks:",
  output(["sudo", "-n", "gdb", "-p", String(pid), "-batch", "-ex", "thread apply all bt"], 60_000),
];

export const recordStalledProcesses = (root: number, path: string) => {
  mkdirSync(dirname(path), { recursive: true });
  if (process.platform === "win32") {
    writeFileSync(path, "Process states are not recorded on Windows.\n");
    return [root];
  }
  const pids = processTree(root);
  const table = output(["ps", "-o", "pid,ppid,stat,wchan,%cpu,rss,etime,command", "-p", pids.join(",")]);
  const details = pids.flatMap((pid) => [
    `## Process ${pid}`,
    ...(process.platform === "linux" ? linuxDetails(pid) : [output(["sample", String(pid), "1"])]),
  ]);
  writeFileSync(path, `${[table, ...details].join("\n\n")}\n`);
  console.error(table);
  return pids;
};

// A blocked process cannot run a SIGTERM handler, so stop the whole tree outright.
export const stopStalledProcesses = (pids: number[]) => {
  if (process.platform === "win32") {
    output(["taskkill", "/T", "/F", "/PID", String(pids[0])]);
    return;
  }
  for (const pid of [...pids].reverse()) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
};
