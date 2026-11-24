import type { ProcessEvent, ProcessExit, ProcessHandle } from "pstdio-api-contracts/extension-kernel";
import { trackProcessCleanup } from "pstdio-extensions";
import { processGroupExited, signalProcessTree, treeExitedWithin } from "./process-group";

/** Unread output a handle may hold, shared by stdout and stderr. Same allowance as `run`. */
export const PROCESS_OUTPUT_CREDIT_BYTES = 8 * 1024 * 1024;
const KILL_GRACE_MS = 500;
/** After the child exits, a read idle this long means only a process it started still holds the pipe. */
const OUTPUT_GRACE_MS = 1_000;

type Child = ReturnType<typeof Bun.spawn<"pipe", "pipe", "pipe">>;

export interface SpawnProcessHandleInput {
  argv: string[];
  cwd?: string;
  env: Record<string, string | undefined>;
  windowsVerbatimArguments?: boolean;
}

const spawnError = (error: unknown) =>
  Object.assign(new Error(`Could not start the process: ${error instanceof Error ? error.message : String(error)}`), {
    code: (error as { code?: string })?.code === "ENOENT" ? "process_command_not_found" : "process_target_unavailable",
    cause: error,
  });

const stdinFor = (child: Child | undefined, started: Promise<void>, stopping: () => boolean) => {
  let ended = false;
  let writes = Promise.resolve();
  const write = (data: string | Uint8Array) => {
    // Closed input is checked when the write is queued: end() lets writes queued before it finish.
    if (ended || stopping()) return Promise.reject(new Error("The process input is closed."));
    const next = writes.then(async () => {
      await started;
      if (stopping()) throw new Error("The process input is closed.");
      child!.stdin.write(data);
      await child!.stdin.flush();
    });
    writes = next.catch(() => {});
    return next;
  };

  const end = async () => {
    if (ended) return writes;
    ended = true;
    await writes;
    if (child && !stopping()) await Promise.resolve(child.stdin.end()).catch(() => {});
  };

  return { write, end };
};

/**
 * A child with writable stdin and streamed output. Output stops being read once the unread
 * events reach the credit, so a slow or absent consumer cannot grow host memory. A natural exit
 * drains output before the final `exit` event; a kill discards unread output and never waits for it.
 */
export const spawnProcessHandle = (
  input: SpawnProcessHandleInput,
  {
    spawner = Bun.spawn as typeof Bun.spawn,
    creditBytes = PROCESS_OUTPUT_CREDIT_BYTES,
    onSpawn = (_child: { pid: number; exited: Promise<unknown> }) => {},
  } = {},
): ProcessHandle => {
  const started = Promise.withResolvers<void>();
  const exited = Promise.withResolvers<ProcessExit>();
  started.promise.catch(() => {});
  const queue: ProcessEvent[] = [];
  let buffered = 0;
  let discarding = false;
  let claimed = false;
  const eventWaiters = new Set<() => void>();
  const creditWaiters: (() => void)[] = [];
  const readers = new Set<ReadableStreamDefaultReader<Uint8Array>>();

  const wake = () => {
    for (const resume of eventWaiters) resume();
    eventWaiters.clear();
  };
  const releaseCredit = () => {
    for (const resume of creditWaiters.splice(0)) resume();
  };
  // `exited` follows the child; the `exit` event follows its output, which may still wait for a reader.
  const finish = (exit: ProcessExit) => {
    exited.resolve(exit);
    queue.push({ type: "exit", exit });
    wake();
  };
  const childExited = Promise.withResolvers<void>();

  let child: Child | undefined;
  try {
    child = spawner(input.argv, {
      cwd: input.cwd,
      env: input.env,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      // Unix needs a separate process group to stop descendants; Windows uses its tree cleanup.
      detached: process.platform !== "win32",
      windowsHide: true,
      windowsVerbatimArguments: input.windowsVerbatimArguments,
    }) as Child;
    onSpawn(child);
    started.resolve();
  } catch (error) {
    started.reject(spawnError(error));
    finish({ code: null, signal: null });
  }

  // After the child exits, a read that stays idle for the grace period is cancelled: its data already
  // arrived, and only a process the child started still holds the pipe. A reader waiting for
  // credit is not idle, so slow consumers still get all output.
  const stopWhenIdle = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    state: { reads: number; reading: boolean; done: boolean },
  ) => {
    await childExited.promise;
    while (!state.done) {
      const seen = state.reads;
      await Bun.sleep(OUTPUT_GRACE_MS);
      if (!state.done && state.reading && state.reads === seen) await reader.cancel().catch(() => {});
    }
  };

  const pump = async (stream: ReadableStream<Uint8Array>, type: "stdout" | "stderr") => {
    const reader = stream.getReader();
    readers.add(reader);
    const state = { reads: 0, reading: false, done: false };
    void stopWhenIdle(reader, state);
    try {
      while (!discarding) {
        state.reading = true;
        const next = await reader.read();
        state.reading = false;
        state.reads += 1;
        if (next.done) break;
        // Split chunks so the unread total never passes the credit; wait while it is spent.
        for (let offset = 0; offset < next.value.byteLength && !discarding; ) {
          if (buffered >= creditBytes) {
            await new Promise<void>((resume) => creditWaiters.push(resume));
            continue;
          }
          const size = Math.min(next.value.byteLength - offset, creditBytes - buffered);
          queue.push({ type, data: next.value.subarray(offset, offset + size) });
          buffered += size;
          offset += size;
          wake();
        }
      }
    } finally {
      state.done = true;
      await reader.cancel().catch(() => {});
      readers.delete(reader);
    }
  };

  let killing: Promise<void> | undefined;
  let groupFinished = false;
  let outputClosed = Promise.resolve();
  let cleanup: Promise<unknown> = exited.promise;
  if (child) {
    const running = child;
    const pumps = Promise.allSettled([pump(running.stdout, "stdout"), pump(running.stderr, "stderr")]);
    outputClosed = running.exited.then(async (code) => {
      const signal = running.signalCode == null ? null : String(running.signalCode);
      const exit = { code: signal ? null : code, signal };
      exited.resolve(exit);
      childExited.resolve();
      // A forced cleanup does not wait for readers; a natural exit delivers what was written.
      await pumps;
      finish(exit);
    });
    const groupClosed = processGroupExited(running).then(() => {
      groupFinished = true;
    });
    cleanup = Promise.allSettled([outputClosed, groupClosed]);
  }

  const { write, end } = stdinFor(child, started.promise, () => killing !== undefined);

  const stopGroup = async (signal: "SIGTERM" | "SIGINT" | "SIGKILL") => {
    if (!child || groupFinished) return;
    await signalProcessTree(child, signal);
    const stopped = await treeExitedWithin(child, KILL_GRACE_MS);
    if (!stopped && !groupFinished && signal !== "SIGKILL") {
      await signalProcessTree(child, "SIGKILL");
      await treeExitedWithin(child, KILL_GRACE_MS);
    }
  };

  const kill = (signal: "SIGTERM" | "SIGINT" | "SIGKILL" = "SIGTERM") => {
    killing ??= (async () => {
      discarding = true;
      // Forced cleanup drops unread output so the exit event does not wait for a consumer.
      for (let index = queue.length - 1; index >= 0; index--) if (queue[index]!.type !== "exit") queue.splice(index, 1);
      buffered = 0;
      releaseCredit();
      const stopped = stopGroup(signal);
      const cancelledReads = Promise.allSettled([...readers].map((reader) => reader.cancel()));
      await stopped;
      await cancelledReads;
      await outputClosed;
    })();
    return killing;
  };

  const events = (): AsyncIterable<ProcessEvent> => {
    if (claimed) throw new Error("A process handle has one output consumer.");
    claimed = true;
    let done = false;
    const iterator: AsyncIterableIterator<ProcessEvent> = {
      [Symbol.asyncIterator]: () => iterator,
      async next() {
        while (!done && queue.length === 0) await new Promise<void>((resume) => eventWaiters.add(resume));
        if (done) return { done: true, value: undefined };
        const event = queue.shift()!;
        if (event.type === "exit") done = true;
        else {
          buffered -= event.data.byteLength;
          releaseCredit();
        }
        return { done: false, value: event };
      },
      // Stopping consumption leaves the child with its owner and releases pending reads immediately.
      async return() {
        done = true;
        wake();
        return { done: true, value: undefined };
      },
    };
    return iterator;
  };

  return trackProcessCleanup(
    { id: crypto.randomUUID(), started: started.promise, exited: exited.promise, write, end, kill, events },
    cleanup,
  );
};
