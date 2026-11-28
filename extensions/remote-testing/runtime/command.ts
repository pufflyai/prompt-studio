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
  const log = createWriteStream(options.logPath);
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

  const collect = async (stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    for await (const bytes of stream) {
      const chunk = decoder.decode(bytes, { stream: true });
      log.write(chunk);
      tail = (tail + chunk).slice(-TAIL_BYTES);
      options.onOutput(tail);
    }
  };
  await Promise.all([collect(child.stdout), collect(child.stderr), child.exited]);
  clearTimeout(deadline);
  clearTimeout(killTimer);
  options.signal.removeEventListener("abort", stop);
  // The shell may exit before its children; never leave test processes behind.
  killGroup(child.pid, "SIGKILL");
  await new Promise<void>((resolve) => log.end(resolve));
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
