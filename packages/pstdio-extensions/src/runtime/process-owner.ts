import type {
  ProcessEvent,
  ProcessExit,
  ProcessHandle,
  ProcessSpawnErrorCode,
  TargetFileErrorCode,
} from "pstdio-api-contracts/extension-kernel";

export const processError = (code: ProcessSpawnErrorCode | TargetFileErrorCode, message: string, cause?: unknown) =>
  Object.assign(new Error(message), { code, ...(cause === undefined ? {} : { cause }) });

type Stoppable = Pick<ProcessHandle, "exited" | "kill">;

/**
 * Owns the children one lifetime started, such as a command invocation, a native agent operation or
 * an extension's enabled source generation. Closing it stops every child that is still running.
 */
export interface ProcessOwner {
  readonly closed: boolean;
  /** Stops the handle when the owner closes, or at once when it already has. */
  adopt(handle: Stoppable): void;
  close(): Promise<void>;
}

export const createProcessOwner = () => {
  const running = new Set<Stoppable>();
  let closing: Promise<void> | undefined;
  const owner: ProcessOwner = {
    get closed() {
      return closing !== undefined;
    },
    adopt(handle) {
      if (closing) {
        void handle.kill().catch(() => {});
        return;
      }
      running.add(handle);
      void handle.exited.finally(() => running.delete(handle)).catch(() => {});
    },
    close() {
      closing ??= Promise.allSettled([...running].map((handle) => handle.kill())).then(() => running.clear());
      return closing;
    },
  };
  return owner;
};

/** Total stdin bytes a handle queues while its target is still being opened. */
const QUEUED_INPUT_CREDIT_BYTES = 8 * 1024 * 1024;
const NO_EXIT: ProcessExit = { code: null, signal: null };

type OpenedHandle = Omit<ProcessHandle, "events"> & {
  // A provider handle from the process runtime returns its iterable through a host call.
  events(): AsyncIterable<ProcessEvent> | Promise<AsyncIterable<ProcessEvent>>;
};

const byteLength = (data: string | Uint8Array) =>
  typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;

/**
 * A handle returned at once for a child whose target opens asynchronously. Writes wait for the
 * open in call order. A failed open rejects `started` with its coded error, settles `exited`
 * without a code and ends `events` with exit.
 *
 * A kill while the target is still opening never waits for it: it aborts `cancel`, settles the
 * handle as stopped, and stops a child that still arrives in the background.
 */
export const createProcessHandleProxy = (open: Promise<OpenedHandle>, cancel = new AbortController()) => {
  open.catch(() => {});
  let opened = false;
  void open.then(
    () => {
      opened = true;
    },
    () => {},
  );
  const stopped = Promise.withResolvers<never>();
  stopped.promise.catch(() => {});
  const gate = Promise.race([open, stopped.promise]);
  gate.catch(() => {});
  const started = gate.then((handle) => handle.started);
  started.catch(() => {});
  const exited = gate.then(
    (handle) => handle.exited.catch(() => NO_EXIT),
    () => NO_EXIT,
  );
  let settled = false;
  void exited.then(() => {
    settled = true;
  });
  let queued = 0;
  let killing: Promise<void> | undefined;
  let claimed = false;

  // end() closes input after every write made before it, even ones nobody awaited.
  let writes: Promise<unknown> = Promise.resolve();
  let ended = false;
  const write = (data: string | Uint8Array) => {
    // Input closes when end() is called, though the child's input closes only after earlier writes.
    if (ended) return Promise.reject(new Error("The process input is closed."));
    const next = queueWrite(data);
    writes = next.catch(() => {});
    return next;
  };
  const queueWrite = async (data: string | Uint8Array) => {
    const size = byteLength(data);
    if (queued + size > QUEUED_INPUT_CREDIT_BYTES)
      throw new Error("Too much input is waiting for the process to start. Await earlier writes first.");
    queued += size;
    let handle: OpenedHandle;
    try {
      handle = await gate;
    } finally {
      queued -= size;
    }
    return handle.write(data);
  };

  const events = () => {
    if (claimed) throw new Error("A process handle has one output consumer.");
    claimed = true;
    return {
      async *[Symbol.asyncIterator]() {
        let handle: OpenedHandle;
        try {
          handle = await gate;
        } catch {
          yield { type: "exit", exit: NO_EXIT } satisfies ProcessEvent;
          return;
        }
        yield* await handle.events();
      },
    };
  };

  const stopWhileOpening = () => {
    const reason = processError("process_owner_closed", "The process was stopped before it started.");
    cancel.abort(reason);
    stopped.reject(reason);
    void open.then(
      (handle) => handle.kill("SIGKILL"),
      () => {},
    );
    return Promise.resolve();
  };

  const handle: ProcessHandle = {
    id: crypto.randomUUID(),
    started,
    exited,
    write,
    end: () => {
      ended = true;
      return writes
        .then(() => gate)
        .then(
          (handle) => handle.end(),
          () => {},
        );
    },
    kill: (signal) => {
      // An exited child's process group may already belong to another process.
      if (settled) return Promise.resolve();
      killing ??= opened
        ? open.then(
            (handle) => handle.kill(signal),
            () => {},
          )
        : stopWhileOpening();
      return killing;
    },
    events,
  };
  return handle;
};

/** A handle for a child that never started. */
export const failedProcessHandle = (error: unknown) => createProcessHandleProxy(Promise.reject(error));
