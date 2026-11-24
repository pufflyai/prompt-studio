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

const cleanupByHandle = new WeakMap<Pick<Stoppable, "exited">, Promise<unknown>>();

export const trackProcessCleanup = <T extends Pick<Stoppable, "exited">>(handle: T, cleanup: Promise<unknown>) => {
  cleanupByHandle.set(handle, cleanup);
  return handle;
};

export const processCleanup = (handle: Pick<Stoppable, "exited">) => cleanupByHandle.get(handle) ?? handle.exited;

/**
 * Owns the children one lifetime started, such as a command invocation, a native agent operation or
 * an extension's enabled source generation. Closing it stops every child that is still running.
 */
export interface ProcessOwner {
  readonly closed: boolean;
  /** Eligibility check for an enabled source generation, when applicable. */
  ready?: Promise<void>;
  /** Stops the handle when the owner closes, or at once when it already has. */
  adopt(handle: Stoppable): void;
  close(): Promise<void>;
}

export const createProcessOwner = () => {
  const running = new Set<Stoppable>();
  let closed = false;
  let closing: Promise<void> | undefined;
  const owner: ProcessOwner = {
    get closed() {
      return closed;
    },
    adopt(handle) {
      if (closed) {
        void Promise.resolve()
          .then(() => handle.kill())
          .catch(() => {});
        return;
      }
      running.add(handle);
      void processCleanup(handle)
        .finally(() => running.delete(handle))
        .catch(() => {});
    },
    close() {
      closed = true;
      if (!closing) {
        closing = Promise.resolve().then(async () => {
          const results = await Promise.allSettled(
            [...running].map(async (handle) => {
              await handle.kill();
              running.delete(handle);
            }),
          );
          const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
          if (failures.length) throw new AggregateError(failures, "Owned process cleanup failed.");
        });
        // A later close can retry only failed children. Admission stays closed.
        void closing.catch(() => {
          closing = undefined;
        });
      }
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

const closedIterator = { done: true, value: undefined } as const;

const processEvents = (gate: Promise<OpenedHandle>) => {
  type Read = ReturnType<typeof Promise.withResolvers<IteratorResult<ProcessEvent>>>;
  const reads = new Set<Read>();
  let source: Promise<AsyncIterator<ProcessEvent> | undefined> | undefined;
  let closed = false;

  const getSource = () =>
    (source ??= gate.then(
      async (handle) => (closed ? undefined : (await handle.events())[Symbol.asyncIterator]()),
      async function* () {
        yield { type: "exit", exit: NO_EXIT } satisfies ProcessEvent;
      },
    ));

  const iterator: AsyncIterableIterator<ProcessEvent> = {
    [Symbol.asyncIterator]: () => iterator,
    next() {
      if (closed) return Promise.resolve(closedIterator);
      const read = Promise.withResolvers<IteratorResult<ProcessEvent>>();
      reads.add(read);
      void getSource()
        .then((inner) => (closed || !inner ? closedIterator : inner.next()))
        .then(read.resolve, read.reject)
        .finally(() => reads.delete(read));
      return read.promise;
    },
    async return() {
      if (!closed) {
        closed = true;
        for (const read of reads) read.resolve(closedIterator);
        reads.clear();
        // The underlying provider may still be opening or waiting on a read.
        void source?.then((inner) => inner?.return?.()).catch(() => {});
      }
      return closedIterator;
    },
  };
  return iterator;
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
  const ready = gate.then(async (handle) => {
    await handle.started;
    return handle;
  });
  const started = ready.then(() => {});
  started.catch(() => {});
  const exited = gate.then(
    (handle) => handle.exited.catch(() => NO_EXIT),
    () => NO_EXIT,
  );
  const cleanup = gate.then(processCleanup, () => {});
  void cleanup.catch(() => {});
  let settled = false;
  void exited.then(() => {
    settled = true;
  });
  let queued = 0;
  let stopping = false;
  let killing: Promise<void> | undefined;
  let claimed = false;

  // end() closes input after every write made before it, even ones nobody awaited.
  let writes: Promise<unknown> = Promise.resolve();
  let ending: Promise<void> | undefined;
  const write = (data: string | Uint8Array) => {
    // Input closes when end() is called, though the child's input closes only after earlier writes.
    if (ending || stopping) return Promise.reject(new Error("The process input is closed."));
    const next = queueWrite(data);
    writes = Promise.allSettled([writes, next]).then(() => {});
    return next;
  };
  const queueWrite = async (data: string | Uint8Array) => {
    const size = byteLength(data);
    if (queued + size > QUEUED_INPUT_CREDIT_BYTES)
      throw new Error("Too much input is waiting for the process to start. Await earlier writes first.");
    queued += size;
    let handle: OpenedHandle;
    try {
      handle = await ready;
    } finally {
      queued -= size;
    }
    return handle.write(data);
  };

  const events = () => {
    if (claimed) throw new Error("A process handle has one output consumer.");
    claimed = true;
    return processEvents(gate);
  };

  const stopWhileOpening = () => {
    const reason = processError("process_owner_closed", "The process was stopped before it started.");
    cancel.abort(reason);
    stopped.reject(reason);
    void open.then((handle) => handle.kill("SIGKILL")).catch(() => {});
    return Promise.resolve();
  };

  const handle: ProcessHandle = {
    id: crypto.randomUUID(),
    started,
    exited,
    write,
    end: () => {
      ending ??= writes
        .then(() => ready)
        .then(
          (handle) => handle.end(),
          () => {},
        );
      return ending;
    },
    kill: (signal) => {
      stopping = true;
      if (!killing) {
        killing = opened
          ? open.then(
              (handle) => {
                if (!settled || cleanupByHandle.has(handle)) return handle.kill(signal);
              },
              () => {},
            )
          : stopWhileOpening();
        void killing.catch(() => {
          killing = undefined;
        });
      }
      return killing;
    },
    events,
  };
  return trackProcessCleanup(handle, cleanup);
};

/** A handle for a child that never started. */
export const failedProcessHandle = (error: unknown) => createProcessHandleProxy(Promise.reject(error));
