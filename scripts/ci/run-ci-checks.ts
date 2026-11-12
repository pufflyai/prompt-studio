import { type ChildProcess, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { finished } from "node:stream/promises";
import { ownedDescendants, signalDescendants } from "./owned-process-tree";
import { createP1Observer } from "./p1-fail-fast";
import { stopsAtFirstFailure, type TestPriority } from "./test-policy";

interface Check {
  id: string;
  command: string[];
  cwd?: string;
}
interface Options {
  priority: TestPriority;
  concurrency?: number;
  env?: NodeJS.ProcessEnv;
  observePeers?: boolean;
  signal?: AbortSignal;
  // Inherit only when a surrounding supervisor owns and terminates the group.
  inheritProcessGroup?: boolean;
  cleanupOnExit?: boolean;
  logDirectory?: string;
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

const terminateChildTree = async (child: ChildProcess, inheritProcessGroup = false, includeDetached = false) => {
  if (!child.pid) return;
  if (inheritProcessGroup) {
    child.kill("SIGTERM");
    return;
  }
  if (process.platform === "win32") {
    await terminateWindowsTree(child.pid);
    return;
  }
  const group = child.pid;
  const errors: unknown[] = [];
  let descendants: ReturnType<typeof ownedDescendants> = [];
  try {
    if (includeDetached) descendants = ownedDescendants(group);
  } catch (error) {
    errors.push(error);
  }
  try {
    process.kill(-group, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH" && !descendants.length && !errors.length) return;
  }
  // Process inspection can fail on a busy host. It must never prevent group cleanup.
  try {
    signalDescendants(descendants, "SIGTERM");
  } catch (error) {
    errors.push(error);
  }
  signalOwnedGroup(group, "SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  signalOwnedGroup(group, "SIGKILL");
  try {
    signalDescendants(descendants, "SIGKILL");
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) throw new AggregateError(errors, `Incomplete descendant cleanup for ${group}`);
};

const openCheckLog = (check: Check, index: number, directory: string | undefined, stop: () => void) => {
  const stream = directory
    ? createWriteStream(join(directory, `${index}-${check.id.replaceAll(/[^a-zA-Z0-9_-]/g, "_")}.log`))
    : undefined;
  let error: unknown;
  stream?.on("error", (failure) => {
    error = failure;
    stop();
  });
  stream?.write(`${JSON.stringify({ id: check.id, command: check.command, cwd: check.cwd })}\n`);
  const close = async () => {
    if (stream) {
      stream.end();
      try {
        await finished(stream);
      } catch (failure) {
        error = failure;
      }
    }
    if (error) console.error(`Could not retain ${check.id} output: ${error}`);
    return !error;
  };
  return { stream, close };
};

export const runCiChecks = async (checks: Check[], options: Options) => {
  if (!checks.length) throw new Error("No CI checks selected");
  if (new Set(checks.map((check) => check.id)).size !== checks.length) throw new Error("Check IDs must be unique");
  const results: CheckResult[] = checks.map((check) => ({ id: check.id, outcome: "cancelled", exitCode: null }));
  const children = new Set<ChildProcess>();
  const cancelled = new Set<ChildProcess>();
  const cleanups = new Map<ChildProcess, Promise<void>>();
  const cleanupFailures: string[] = [];
  const cleanup = (child: ChildProcess) => {
    if (cleanups.has(child)) return;
    cleanups.set(
      child,
      terminateChildTree(child, options.inheritProcessGroup, options.cleanupOnExit).catch((error) => {
        cleanupFailures.push(String(error));
        console.error(error);
      }),
    );
  };
  let next = 0;
  let stopped = false;
  const terminate = (child: ChildProcess) => {
    cancelled.add(child);
    cleanup(child);
  };
  const stop = () => {
    stopped = true;
    for (const child of children) terminate(child);
  };
  const executeCheck = async (index: number) => {
    const check = checks[index];
    const [command, ...args] = check.command;
    if (!command) throw new Error(`${check.id}: command is empty`);
    console.log(`::group::${options.priority} ${check.id}`);
    if (options.logDirectory) await mkdir(options.logDirectory, { recursive: true });
    if (stopped) return;
    const { stream: log, close: closeLog } = openCheckLog(check, index, options.logDirectory, stop);
    const child = spawn(command, args, {
      cwd: check.cwd,
      env: { ...process.env, ...options.env, CI_PRIORITY: options.priority },
      detached: process.platform !== "win32" && !options.inheritProcessGroup,
      stdio: log ? ["inherit", "pipe", "pipe"] : "inherit",
    });
    child.stdout?.on("data", (data) => {
      log?.write(data);
      process.stdout.write(data);
    });
    child.stderr?.on("data", (data) => {
      log?.write(data);
      process.stderr.write(data);
    });
    child.once("exit", () => {
      if (options.cleanupOnExit) cleanup(child);
    });
    children.add(child);
    if (stopped) terminate(child);
    const exitCode = await new Promise<number | null>((resolve) => {
      child.once("error", (error) => {
        console.error(error);
        resolve(1);
      });
      child.once("close", (code) => resolve(code));
    });
    const logSucceeded = await closeLog();
    children.delete(child);
    let outcome: CheckResult["outcome"] = "failure";
    if (cancelled.has(child)) outcome = "cancelled";
    else if (exitCode === 0 && logSucceeded) outcome = "success";
    results[index] = { id: check.id, outcome, exitCode };
    console.log(`::endgroup::\n${check.id}: ${outcome}`);
    if (outcome === "failure" && stopsAtFirstFailure(options.priority)) stop();
  };
  const worker = async () => {
    while (!stopped && next < checks.length) await executeCheck(next++);
  };
  options.signal?.addEventListener("abort", stop, { once: true });
  if (options.signal?.aborted) stop();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  let polling = false;
  const readPeerFailure = createP1Observer(process.env);
  const observePeers = async () => {
    if (polling || stopped || !stopsAtFirstFailure(options.priority) || !options.observePeers) return;
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
  const interval = stopsAtFirstFailure(options.priority)
    ? setInterval(() => {
        void observePeers();
      }, 30000)
    : undefined;
  try {
    await Promise.all(Array.from({ length: Math.min(checks.length, options.concurrency ?? 1) }, worker));
  } finally {
    if (interval) clearInterval(interval);
    for (const child of children) terminate(child);
    try {
      await Promise.all(cleanups.values());
    } finally {
      options.signal?.removeEventListener("abort", stop);
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    }
  }
  return {
    results,
    ...(cleanupFailures.length ? { cleanupFailures } : {}),
    outcome:
      results.every((result) => result.outcome === "success") && !cleanupFailures.length
        ? ("success" as const)
        : ("failure" as const),
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
