import type { ChildProcessWithoutNullStreams } from "node:child_process";
import spawn from "cross-spawn";
import { resolvePiCommand } from "./cli";

export interface PiProcessOptions {
  command?: string[];
  env?: Record<string, string>;
  cwd?: string;
  signal?: AbortSignal;
}

const terminateTree = async (child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals) => {
  if (!child.pid) return;
  if (process.platform === "win32") {
    const task = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    await new Promise<void>((resolve) => {
      task.once("close", () => resolve());
      task.once("error", () => resolve());
    });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return;
    // Darwin may refuse a group signal while its leader is exiting. See ADR 0115.
    if (process.platform === "darwin" && code === "EPERM") {
      child.kill(signal);
      return;
    }
    throw error;
  }
};

export const startPiProcess = (args: string[], options: PiProcessOptions = {}) => {
  options.signal?.throwIfAborted();
  const resolved = options.command ? { command: options.command, env: {} } : resolvePiCommand();
  const [command, ...prefix] = resolved.command;
  const child = spawn(command, [...prefix, ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env, ...resolved.env },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  }) as ChildProcessWithoutNullStreams;
  let diagnostics = "";
  child.stderr.on("data", (chunk) => {
    diagnostics = (diagnostics + chunk.toString()).slice(-4096);
  });
  // A process that exits before consuming its prompt must fail through `exited`, not an unhandled EPIPE.
  child.stdin.on("error", () => {});
  let closed = false;
  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      closed = true;
      resolve({ code, signal });
    });
  });
  void exited.catch(() => {});
  let stopping: Promise<void> | undefined;
  const stop = () =>
    (stopping ??= (async () => {
      if (closed) return;
      await terminateTree(child, "SIGTERM");
      const timer = setTimeout(() => {
        void terminateTree(child, "SIGKILL");
      }, 2000);
      timer.unref();
      try {
        await exited;
      } catch {
        /* Spawn failures have no process to terminate. */
      } finally {
        clearTimeout(timer);
      }
    })());
  const abort = () => {
    void stop();
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  void exited.finally(() => options.signal?.removeEventListener("abort", abort)).catch(() => {});
  if (options.signal?.aborted) abort();
  return { child, exited, stop, diagnostics: () => diagnostics };
};

export async function* piRecords(stdout: AsyncIterable<Buffer>) {
  const decoder = new TextDecoder();
  let pending = "";
  for await (const chunk of stdout) {
    pending += decoder.decode(chunk, { stream: true });
    let end = pending.indexOf("\n");
    while (end !== -1) {
      const line = pending.slice(0, end).trim();
      pending = pending.slice(end + 1);
      if (line) yield JSON.parse(line) as Record<string, unknown>;
      end = pending.indexOf("\n");
    }
  }
  pending += decoder.decode();
  if (pending.trim()) yield JSON.parse(pending) as Record<string, unknown>;
}

export const piRequest = async (type: string, args: string[], options: PiProcessOptions = {}) => {
  const process = startPiProcess(["--mode", "rpc", ...args], options);
  const timer = setTimeout(() => {
    void process.stop();
  }, 10000);
  timer.unref();
  try {
    process.child.stdin.write(`${JSON.stringify({ id: "request", type })}\n`);
    for await (const record of piRecords(process.child.stdout)) {
      if (record.type !== "response" || record.id !== "request") continue;
      if (!record.success) throw new Error(String(record.error));
      return record.data as Record<string, unknown>;
    }
    await process.exited;
    throw new Error(`Pi did not answer ${type}. ${process.diagnostics()}`);
  } finally {
    clearTimeout(timer);
    await process.stop();
  }
};
