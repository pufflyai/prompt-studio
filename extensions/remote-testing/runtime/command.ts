import { createWriteStream } from "node:fs";

const TAIL_BYTES = 32 * 1024;

export interface CommandRun {
  exitCode: number | null;
  timedOut: boolean;
  aborted: boolean;
  tail: string;
}

// Runs one shell command in its own process group. Output goes to the full log file and
// a bounded tail that the conversation can carry.
export async function runCommand(options: {
  command: string;
  cwd: string;
  logPath: string;
  timeoutSeconds: number;
  env: Record<string, string | undefined>;
  signal: AbortSignal;
  onOutput(tail: string): void;
}): Promise<CommandRun> {
  // The abort may have arrived during source installation, before this listener existed.
  if (options.signal.aborted) return { exitCode: null, timedOut: false, aborted: true, tail: "" };
  const log = createWriteStream(options.logPath);
  let logError: Error | undefined;
  // A full workspace volume surfaces as a stream error. Capture it instead of
  // crashing the runner, then reject after the process and log are cleaned up.
  const logFailure = new Promise<never>((_, reject) => {
    log.on("error", (error) => {
      logError = error;
      reject(error);
    });
  });
  let tail = "";
  const child = Bun.spawn(["sh", "-c", options.command], {
    cwd: options.cwd,
    env: options.env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
  let timedOut = false;
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    killGroup(child.pid, "SIGTERM");
    killTimer = setTimeout(() => killGroup(child.pid, "SIGKILL"), 5000);
  };
  const deadline = setTimeout(() => {
    timedOut = true;
    stop();
  }, options.timeoutSeconds * 1000);
  options.signal.addEventListener("abort", stop, { once: true });

  const write = async (chunk: string) => {
    if (logError) throw logError;
    if (log.write(chunk)) return;
    // Respect the stream's buffer so a chatty suite cannot grow it without bound.
    await new Promise<void>((resolve) => {
      const done = () => {
        log.off("drain", done);
        log.off("error", done);
        resolve();
      };
      log.once("drain", done);
      log.once("error", done);
    });
  };
  const collect = async (stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    for await (const bytes of stream) {
      const chunk = decoder.decode(bytes, { stream: true });
      await write(chunk);
      tail = (tail + chunk).slice(-TAIL_BYTES);
      options.onOutput(tail);
    }
  };
  try {
    // A silent command must not keep the run alive after its log failed.
    await Promise.race([Promise.all([collect(child.stdout), collect(child.stderr), child.exited]), logFailure]);
  } finally {
    clearTimeout(deadline);
    clearTimeout(killTimer);
    options.signal.removeEventListener("abort", stop);
    // The shell may exit before its children; never leave test processes behind.
    killGroup(child.pid, "SIGKILL");
    await new Promise<void>((resolve) => {
      if (log.destroyed) return resolve();
      log.once("close", resolve);
      log.end(() => resolve());
    });
  }
  if (logError) throw logError;
  const aborted = options.signal.aborted;
  return { exitCode: timedOut || aborted ? null : child.exitCode, timedOut, aborted, tail };
}

function killGroup(pid: number, signal: "SIGTERM" | "SIGKILL") {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}
