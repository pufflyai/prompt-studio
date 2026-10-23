import { execFile, execFileSync, spawn } from "node:child_process";
import { contract } from "./contract";

interface BenchmarkCase {
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
  stdout?: number;
  stderr?: number;
  // Docker services are outside the host process tree. Only name the owned service.
  containerFilters?: string[];
  emit: (event: object) => void;
}

const kill = (pid: number, signal: NodeJS.Signals) => {
  try {
    process.kill(pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
};

const terminateTree = (pid: number) => {
  if (process.platform === "win32") {
    execFileSync("taskkill", ["/pid", String(pid), "/T", "/F"], { timeout: 1_000, stdio: "ignore" });
    return;
  }
  // Freeze the owned group at expiry before inspecting children that made new groups
  // (Chromium does this). Do not let synchronous work run during that inspection.
  kill(-pid, "SIGSTOP");
  try {
    const rows = execFileSync("ps", ["-axo", "pid=,ppid="], { encoding: "utf8", timeout: 1_000 })
      .trim()
      .split("\n")
      .map((row) => row.trim().split(/\s+/).map(Number));
    const descendants = new Set([pid]);
    let previous = 0;
    while (previous !== descendants.size) {
      previous = descendants.size;
      for (const [child, parent] of rows) if (descendants.has(parent)) descendants.add(child);
    }
    for (const child of [...descendants].reverse()) if (child !== pid) kill(child, "SIGKILL");
  } finally {
    kill(-pid, "SIGKILL");
  }
};

const docker = (args: string[]) =>
  new Promise<string>((resolve, reject) => {
    execFile("docker", args, { timeout: 1_000, encoding: "utf8" }, (error, stdout) =>
      error ? reject(error) : resolve(stdout.trim()),
    );
  });

const stopContainers = async (filters: string[]) => {
  if (!filters.length) return [];
  try {
    const ids = (await docker(["ps", "-aq", ...filters.flatMap((filter) => ["--filter", filter])]))
      .split(/\s+/)
      .filter(Boolean);
    if (ids.length) await docker(["stop", "--time", "0", ...ids]);
    return [];
  } catch (error) {
    return [`Could not stop owned containers: ${String(error)}`];
  }
};

type CaseStatus = "completed" | "failed" | "timed-out" | "aborted";

interface CaseCompletion {
  status: CaseStatus;
  completionReceived: boolean;
  cleanupErrors: string[];
  error?: string;
  elapsedWallMs: number;
  limitMs: number;
}

export const finalizeBenchmarkCase = (input: CaseCompletion) => {
  const cleanupErrors = [...input.cleanupErrors];
  if (input.error) cleanupErrors.push(input.error);
  let status = input.status;
  if (!input.completionReceived && status !== "timed-out" && status !== "aborted")
    cleanupErrors.push("Worker exited without completion handshake; detached-child cleanup is unverified");
  if (cleanupErrors.length && status === "completed") status = "failed";
  if (input.elapsedWallMs >= input.limitMs) status = "timed-out";
  return { status, complete: status === "completed", passed: status === "completed", cleanupErrors };
};

export const runBenchmarkCase = async (input: BenchmarkCase) => {
  const limitMs = Math.min(input.timeoutMs ?? contract.caseTimeoutMs, contract.caseTimeoutMs);
  if (!Number.isFinite(limitMs) || limitMs <= 0) throw new Error("Case allowance must be positive and finite");
  const started = performance.now();
  input.emit({ phase: "case-start", case: input.name, limitMs, boundary: "spawn-through-worker-exit-including-setup" });
  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    env: { ...process.env, PSTDIO_SCALE_SUPERVISOR_PID: String(process.pid) },
    detached: process.platform !== "win32",
    stdio: ["ignore", input.stdout ?? "inherit", input.stderr ?? "inherit", "ipc"],
  });
  let status: CaseStatus = "failed";
  let termination: Promise<string[]> | undefined;
  let reapTimer: ReturnType<typeof setTimeout> | undefined;
  let completionCode: number | undefined;
  const unreaped = Promise.withResolvers<{ code: null; signal: null; error: string }>();
  const terminate = (reason: CaseStatus) => {
    if (termination) return;
    status = reason;
    const errors: string[] = [];
    if (child.pid) {
      try {
        terminateTree(child.pid);
      } catch (error) {
        errors.push(String(error));
        child.kill("SIGKILL");
      }
    }
    termination = stopContainers(input.containerFilters ?? []).then((results) => [...errors, ...results]);
    // A failed OS kill must not leave the supervisor awaiting exit indefinitely.
    reapTimer = setTimeout(() => {
      if (child.connected) child.disconnect();
      child.unref();
      unreaped.resolve({
        code: null,
        signal: null,
        error: "Owned worker exit not observed after termination; verify cleanup before another run",
      });
    }, 1_000);
  };
  const abort = () => terminate("aborted");
  child.on("message", (message) => {
    if (typeof message !== "object" || message === null || !("benchmarkComplete" in message)) return;
    const code = message.benchmarkComplete;
    if (code !== 0 && code !== 1) return;
    completionCode = code;
    // The worker stays alive until this scan/kill. Detached descendants have not
    // been reparented and remain attributable to the owned worker.
    const completionStatus = code === 0 ? "completed" : "failed";
    terminate(performance.now() - started >= limitMs ? "timed-out" : completionStatus);
  });
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  // Absolute deadline. Output/progress never changes this timer.
  const timer = setTimeout(() => terminate("timed-out"), Math.max(0, limitMs - (performance.now() - started)));
  try {
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null; error?: string }>((resolve) => {
      child.once("error", (error) => resolve({ code: null, signal: null, error: String(error) }));
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    const exit = await Promise.race([exited, unreaped.promise]);
    if (!termination && performance.now() - started >= limitMs) terminate("timed-out");
    clearTimeout(timer);
    const workerWallMs = performance.now() - started;
    if (!termination) terminate("failed");
    const cleanupErrors = await termination!;
    const elapsedWallMs = performance.now() - started;
    const result = {
      case: input.name,
      ...finalizeBenchmarkCase({
        status: status as CaseStatus,
        completionReceived: completionCode !== undefined,
        cleanupErrors,
        error: exit.error,
        elapsedWallMs,
        limitMs,
      }),
      limitMs,
      elapsedWallMs,
      workerWallMs,
      exitCode: completionCode ?? exit.code,
      workerExitCode: exit.code,
      workerPid: child.pid,
      completionReceived: completionCode !== undefined,
      signal: exit.signal,
      error: exit.error,
      acceptedTiming: false,
    };
    input.emit({ phase: "case-end", ...result });
    return result;
  } finally {
    clearTimeout(timer);
    clearTimeout(reapTimer);
    process.off("SIGINT", abort);
    process.off("SIGTERM", abort);
  }
};

// Direct layer commands receive the same watchdog as the suite controller. The
// marker identifies the immediate supervising parent, rather than an inherited flag.
export const runBenchmarkEntrypoint = async (
  name: string,
  run: () => Promise<void>,
  resources: Pick<BenchmarkCase, "containerFilters"> = {},
) => {
  if (process.env.PSTDIO_SCALE_SUPERVISOR_PID === String(process.ppid)) return completeBenchmarkWorker(run);
  const result = await runBenchmarkCase({
    name,
    command: process.execPath,
    args: process.argv.slice(1),
    ...resources,
    emit: (event) => console.log(JSON.stringify(event)),
  });
  if (!result.complete) process.exitCode = 1;
};

export const assertBenchmarkWorker = () => {
  if (!process.send || process.env.PSTDIO_SCALE_SUPERVISOR_PID !== String(process.ppid))
    throw new Error("Benchmark worker needs its external IPC supervisor");
  return process.send.bind(process);
};

export const completeBenchmarkWorker = async (run: () => Promise<void>) => {
  const send = assertBenchmarkWorker();
  let code = 0;
  try {
    await run();
  } catch (error) {
    console.error(error);
    code = 1;
  }
  send({ benchmarkComplete: code });
  // Keep the tree rooted until the parent has inspected and terminated it. This
  // is cooperative completion only; the hard deadline never depends on a message.
  await new Promise(() => {});
};
