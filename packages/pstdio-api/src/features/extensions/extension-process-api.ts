import { createServer } from "node:net";
import type { ProcessRunInput } from "pstdio-api-contracts/extension-kernel";
import {
  type CommandRunnerEnvironment,
  createExtensionProcessEnvironment,
  type InvocationScope,
} from "pstdio-extensions";
import { resolveProcessCommand } from "./process-command";
import { signalProcessTree } from "./process-group";

type ProcessSpawner = typeof Bun.spawn;

/**
 * Combined stdout and stderr the host keeps in memory for one command. The API process also
 * hosts the embedded database, so a runaway command must not be allowed to grow without bound.
 */
export const PROCESS_OUTPUT_LIMIT_BYTES = 8 * 1024 * 1024;

const processOutput = (result: { stdout: string; stderr: string }) =>
  [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");

interface OutputBudget {
  used: number;
}

// Decodes a child stream while charging it against the shared output budget. Reading ends as
// soon as the budget runs out or the host stops the command, so the text never grows past the
// limit and a stopped command stops buffering whatever its children keep writing.
const readWithinBudget = async (
  stream: ReadableStream<Uint8Array>,
  budget: OutputBudget,
  onExceeded: () => void,
  released: Promise<null>,
) => {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let text = "";

  try {
    while (true) {
      const next = await Promise.race([reader.read(), released]);
      if (!next || next.done) break;

      budget.used += next.value.byteLength;
      if (budget.used > PROCESS_OUTPUT_LIMIT_BYTES) {
        onExceeded();
        break;
      }
      text += decoder.decode(next.value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return text + decoder.decode();
};

/**
 * One-shot gate the host uses to stop a running command. `failed` settles the call at the moment
 * the host gives up; `released` frees the output readers so nothing waits on a pipe a grandchild
 * is still holding open.
 */
const createStopGate = (kill: () => void) => {
  let stopped = false;
  let release: (value: null) => void = () => {};
  let fail: (reason: unknown) => void = () => {};

  const released = new Promise<null>((resolve) => {
    release = resolve;
  });
  const failed = new Promise<never>((_resolve, reject) => {
    fail = reject;
  });
  failed.catch(() => {});

  return {
    released,
    failed,
    stop(reason: unknown) {
      if (stopped) return;
      stopped = true;
      kill();
      release(null);
      fail(reason);
    },
  };
};

export interface ProcessApiOptions {
  /** Invocation that owns the spawned children. Absent for host-level probes. */
  scope?: InvocationScope;
  resolveCwd?: () => Promise<string>;
  spawner?: ProcessSpawner;
}

export const createProcessApi = (options: ProcessApiOptions = {}): CommandRunnerEnvironment["process"] => {
  const spawner = options.spawner ?? Bun.spawn;
  const signal = options.scope?.signal;
  let closed = false;
  const ensureActive = () => {
    if (signal?.aborted) throw signal.reason;
    if (closed) throw new Error("Invocation ended before the command could start.");
  };
  const resolveInput = async (input: ProcessRunInput) => {
    ensureActive();
    const cwd = await options.resolveCwd?.();
    return { ...input, cwd: input.cwd ?? cwd };
  };

  // Children outliving the invocation that started them is the leak this owns. The scope
  // stops whatever is still running when the invocation ends, however it ended.
  const running = new Set<(reason: unknown) => void>();
  options.scope?.register(() => {
    closed = true;
    for (const stop of [...running]) stop(new Error("Invocation ended while the command was still running."));
  });

  const runToCompletion = async (input: ProcessRunInput) => {
    input = await resolveInput(input);
    ensureActive();

    const resolved = resolveProcessCommand(input.command);
    // Its own process group, so stopping the command also stops whatever it started. Killing
    // the direct child alone leaves a shell's background jobs running with nobody to stop them.
    const child = spawner(resolved.argv, {
      cwd: input.cwd,
      detached: true,
      env: createExtensionProcessEnvironment(process.env, input.env),
      stderr: "pipe",
      stdout: "pipe",
      windowsHide: true,
      windowsVerbatimArguments: resolved.windowsVerbatimArguments,
    });

    const gate = createStopGate(() => signalProcessTree(child, "SIGKILL"));
    running.add(gate.stop);

    const timeout =
      input.timeoutMs === undefined
        ? undefined
        : setTimeout(
            () => gate.stop(new Error(`Command timed out after ${input.timeoutMs} ms: ${input.command.join(" ")}`)),
            input.timeoutMs,
          );
    const onAbort = () => gate.stop(signal?.reason);
    signal?.addEventListener("abort", onAbort, { once: true });

    const budget: OutputBudget = { used: 0 };
    const onExceeded = () =>
      gate.stop(
        new Error(
          `Command exceeded the 8 MiB output limit: ${input.command.join(" ")}. Write large output to a file instead.`,
        ),
      );

    const collect = Promise.all([
      readWithinBudget(child.stdout as ReadableStream<Uint8Array>, budget, onExceeded, gate.released),
      readWithinBudget(child.stderr as ReadableStream<Uint8Array>, budget, onExceeded, gate.released),
      child.exited,
    ]).then(([stdout, stderr, exitCode]) => ({ exitCode, stdout, stderr }));
    collect.catch(() => {});

    try {
      return await Promise.race([collect, gate.failed]);
    } finally {
      running.delete(gate.stop);
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  };

  const api: CommandRunnerEnvironment["process"] = {
    run: runToCompletion,
    async runOrThrow(input) {
      const result = await runToCompletion(input);
      if (result.exitCode === 0) return result;

      throw new Error(processOutput(result) || `Command failed: ${input.command.join(" ")}`);
    },
    async spawnDetached(input) {
      input = await resolveInput(input);
      ensureActive();
      const resolved = resolveProcessCommand(input.command);
      const proc = spawner(resolved.argv, {
        detached: true,
        cwd: input.cwd,
        env: createExtensionProcessEnvironment(process.env, input.env),
        stderr: "ignore",
        stdin: "ignore",
        stdout: "ignore",
        windowsHide: true,
        windowsVerbatimArguments: resolved.windowsVerbatimArguments,
      });
      proc.unref();
      return { pid: proc.pid };
    },
  };

  return api;
};

export const findFreePort = (host = "127.0.0.1") =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a free port")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
