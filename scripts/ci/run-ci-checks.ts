import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createP1Observer } from "./p1-fail-fast";
import type { TestPriority } from "./test-policy";

interface Check {
  id: string;
  command: string[];
  cwd?: string;
}
interface Options {
  priority: TestPriority;
  concurrency?: number;
  env?: Record<string, string>;
  observePeers?: boolean;
}
interface CheckResult {
  id: string;
  outcome: "success" | "failure" | "cancelled";
  exitCode: number | null;
}

const terminateWindowsTree = (pid: number) =>
  new Promise<void>((resolve) => {
    // Windows signals terminate only one process. taskkill owns the full tree while
    // its leader still exists, before descendants can lose that parent identity.
    const executable = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
    const killer = spawn(executable, ["/PID", String(pid), "/T", "/F"], { stdio: "inherit", windowsHide: true });
    killer.once("error", (error) => {
      console.error(`Could not terminate owned process tree ${pid}: ${error}`);
      resolve();
    });
    killer.once("exit", (code) => {
      if (code !== 0) console.error(`Owned process tree ${pid} termination exited with ${code}`);
      resolve();
    });
  });

const signalOwnedGroup = (pid: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH")
      console.error(`Could not signal owned process group ${pid}: ${error}`);
  }
};

const terminateChildTree = async (child: ChildProcess) => {
  if (!child.pid) return;
  if (process.platform === "win32") {
    await terminateWindowsTree(child.pid);
    return;
  }
  const group = child.pid;
  signalOwnedGroup(group, "SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // A leader's exit does not prove its descendants stopped. Keep ownership of
  // this detached group until the existing termination grace has elapsed.
  signalOwnedGroup(group, "SIGKILL");
};

export const runCiChecks = async (checks: Check[], options: Options) => {
  if (!checks.length) throw new Error("No CI checks selected");
  if (new Set(checks.map((check) => check.id)).size !== checks.length) throw new Error("Check IDs must be unique");
  const results: CheckResult[] = checks.map((check) => ({ id: check.id, outcome: "cancelled", exitCode: null }));
  const children = new Set<ChildProcess>();
  const cancelled = new Set<ChildProcess>();
  const cleanups = new Map<ChildProcess, Promise<void>>();
  let next = 0;
  let stopped = false;
  const terminate = (child: ChildProcess) => {
    cancelled.add(child);
    if (!cleanups.has(child)) cleanups.set(child, terminateChildTree(child));
  };
  const stop = () => {
    stopped = true;
    for (const child of children) terminate(child);
  };
  const worker = async () => {
    while (!stopped && next < checks.length) {
      const index = next++;
      const check = checks[index];
      const [command, ...args] = check.command;
      if (!command) throw new Error(`${check.id}: command is empty`);
      console.log(`::group::${options.priority} ${check.id}`);
      const child = spawn(command, args, {
        cwd: check.cwd,
        env: { ...process.env, ...options.env, CI_PRIORITY: options.priority },
        detached: process.platform !== "win32",
        stdio: "inherit",
      });
      children.add(child);
      const exitCode = await new Promise<number | null>((resolve) => {
        child.once("error", (error) => {
          console.error(error);
          resolve(1);
        });
        child.once("exit", (code) => resolve(code));
      });
      children.delete(child);
      let outcome: CheckResult["outcome"] = "failure";
      if (cancelled.has(child)) outcome = "cancelled";
      else if (exitCode === 0) outcome = "success";
      results[index] = { id: check.id, outcome, exitCode };
      console.log(`::endgroup::\n${check.id}: ${outcome}`);
      if (outcome === "failure" && options.priority === "P1") stop();
    }
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  let polling = false;
  const readPeerFailure = createP1Observer(process.env);
  const observePeers = async () => {
    if (polling || stopped || options.priority !== "P1" || !options.observePeers) return;
    polling = true;
    try {
      const failed = await readPeerFailure();
      if (failed) {
        console.error(`P1 stopped after ${failed.name}: ${failed.conclusion}`);
        stop();
      }
    } catch (error) {
      console.warn(`P1 peer observation unavailable; local checks continue: ${String(error)}`);
    } finally {
      polling = false;
    }
  };
  await observePeers();
  const interval =
    options.priority === "P1"
      ? setInterval(() => {
          void observePeers();
        }, 30000)
      : undefined;
  try {
    await Promise.all(Array.from({ length: Math.min(checks.length, options.concurrency ?? 1) }, worker));
  } finally {
    if (interval) clearInterval(interval);
    try {
      await Promise.all(cleanups.values());
    } finally {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    }
  }
  return {
    results,
    outcome: results.every((result) => result.outcome === "success") ? ("success" as const) : ("failure" as const),
  };
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const value = (flag: string) => {
    const index = args.indexOf(flag);
    return index < 0 ? undefined : args[index + 1];
  };
  const priority = value("--priority") ?? process.env.CI_PRIORITY ?? "P1";
  if (!["P0", "P1", "P2", "P3"].includes(priority)) throw new Error(`Unknown test priority: ${priority}`);
  const plan = value("--plan");
  const checks: Check[] = plan
    ? await Bun.file(plan).json()
    : [{ id: process.env.GITHUB_JOB ?? "check", command: args.slice(args.indexOf("--") + 1) }];
  if (!plan && !args.includes("--")) throw new Error("Pass --plan <json> or -- <command> [args]");
  const result = await runCiChecks(checks, {
    priority: priority as TestPriority,
    observePeers: args.includes("--observe-peers"),
  });
  const report = value("--report");
  if (report) {
    await mkdir(dirname(report), { recursive: true });
    await writeFile(report, `${JSON.stringify({ priority, ...result }, null, 2)}\n`);
  }
  process.exitCode = result.outcome === "success" ? 0 : 1;
}
