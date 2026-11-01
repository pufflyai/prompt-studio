import { appendFileSync, mkdirSync, readdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// PS-1013: a stalled API test file blocked its process, and the job limit cancelled the
// shard without any record of what that process was doing. Record it before stopping it.

// The timeout's default SIGTERM does not stop a debugger attaching to an uninterruptible process.
const output = (command: string[], timeout = 30_000) => {
  try {
    const result = Bun.spawnSync(command, { timeout, killSignal: "SIGKILL", stdout: "pipe", stderr: "pipe" });
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

// Thread states, wait channels and kernel stacks tell a busy loop from a blocked call. Hosted
// Linux runners allow the root reads through passwordless sudo; gdb is used only if installed.
const linuxDetails = (pid: number) =>
  [
    read(`/proc/${pid}/status`),
    "Threads (id, state, kernel wait channel):",
    ...list(`/proc/${pid}/task`).map(
      (thread) =>
        `${thread} ${read(`/proc/${pid}/task/${thread}/stat`).split(") ")[1]?.split(" ")[0]} ${read(`/proc/${pid}/task/${thread}/wchan`)}`,
    ),
    "Open files:",
    ...list(`/proc/${pid}/fd`).map((fd) => `${fd} -> ${link(`/proc/${pid}/fd/${fd}`)}`),
    "Kernel stacks per thread:",
    output(["sudo", "-n", "sh", "-c", `for task in /proc/${pid}/task/*; do echo "$task"; cat "$task/stack"; done`]),
    "Native stacks:",
    output([
      "sudo",
      "-n",
      "timeout",
      "-s",
      "KILL",
      "20",
      "gdb",
      "-p",
      String(pid),
      "-batch",
      "-ex",
      "thread apply all bt",
    ]),
  ].join("\n");

// Writes as it goes, so a slow or failing step still leaves the earlier evidence.
export const recordStalledProcesses = (root: number, path: string) => {
  mkdirSync(dirname(path), { recursive: true });
  if (process.platform === "win32") {
    writeFileSync(path, "Process states are not recorded on Windows.\n");
    return;
  }
  const pids = processTree(root);
  const table = output(["ps", "-o", "pid,ppid,stat,wchan,%cpu,rss,etime,command", "-p", pids.join(",")]);
  console.error(table);
  writeFileSync(path, `${table}\n`);
  for (const pid of pids) {
    const sample = join(dirname(path), `sample-${pid}.txt`);
    const details =
      process.platform === "linux"
        ? linuxDetails(pid)
        : `${output(["sample", String(pid), "1", "-file", sample])}\nSample: ${sample}`;
    appendFileSync(path, `\n## Process ${pid}\n\n${details}\n`);
  }
};

// The wrapper's death does not stop a blocked `bun test` under it, and a blocked process cannot
// run a SIGTERM handler, so the whole tree, walked again at this point, is killed outright.
export const stopProcessTree = (root: number) => {
  if (process.platform === "win32") {
    output([
      join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"),
      "/T",
      "/F",
      "/PID",
      String(root),
    ]);
    return;
  }
  for (const pid of processTree(root).reverse()) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
};
