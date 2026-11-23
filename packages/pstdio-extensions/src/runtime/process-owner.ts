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

export const createProcessOwner = (): ProcessOwner => {
  const running = new Set<Stoppable>();
  let closing: Promise<void> | undefined;
  return {
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
 * open in call order; a kill before it opens stops the child as soon as it exists. A failed open
 * rejects `started` with its coded error, settles `exited` without a code and ends `events` with exit.
 */
export const createProcessHandleProxy = (open: Promise<OpenedHandle>): ProcessHandle => {
  open.catch(() => {});
  const started = open.then((handle) => handle.started);
  started.catch(() => {});
  const exited = open.then(
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

  const write = async (data: string | Uint8Array) => {
    const size = byteLength(data);
    if (queued + size > QUEUED_INPUT_CREDIT_BYTES)
      throw new Error("Too much input is waiting for the process to start. Await earlier writes first.");
    queued += size;
    let handle: OpenedHandle;
    try {
      handle = await open;
    } finally {
      queued -= size;
    }
    return handle.write(data);
  };

  const events = (): AsyncIterable<ProcessEvent> => {
    if (claimed) throw new Error("A process handle has one output consumer.");
    claimed = true;
    return {
      async *[Symbol.asyncIterator]() {
        let handle: OpenedHandle;
        try {
          handle = await open;
        } catch {
          yield { type: "exit", exit: NO_EXIT };
          return;
        }
        yield* await handle.events();
      },
    };
  };

  return {
    id: crypto.randomUUID(),
    started,
    exited,
    write,
    end: () =>
      open.then(
        (handle) => handle.end(),
        () => {},
      ),
    kill: (signal) => {
      // An exited child's process group may already belong to another process.
      if (settled) return Promise.resolve();
      killing ??= open.then(
        (handle) => handle.kill(signal),
        () => {},
      );
      return killing;
    },
    events,
  };
};

/** A handle for a child that never started. */
export const failedProcessHandle = (error: unknown) => createProcessHandleProxy(Promise.reject(error));
