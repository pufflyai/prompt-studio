import { deserializeBackendError, type SerializedBackendError, serializeBackendError } from "./protocol";

/**
 * Functions, async iterables and abort signals that cross the worker boundary inside an invocation.
 * The side that owns one keeps it in its table and sends a reference; the other side gets a stub
 * that calls back. Tables belong to one invocation and are cleared when it settles.
 *
 * Only plain objects and arrays are walked. Their own function properties are the deliberate API
 * of a handle, such as `{ close() }`. Class instances, maps, URLs and other objects cross as cloned
 * data, so a host object's methods and internals never become callable by accident.
 */
const FUNCTION_MARKER = "$pstdioFunction";
const ITERATOR_MARKER = "$pstdioIterator";
const SIGNAL_MARKER = "$pstdioSignal";
const BLOB_MARKER = "$pstdioBlob";
const MARKERS = [FUNCTION_MARKER, ITERATOR_MARKER, SIGNAL_MARKER, BLOB_MARKER];

type RemoteFunction = (...args: unknown[]) => unknown;
type FunctionRef = { [FUNCTION_MARKER]: string };
type IteratorRef = { [ITERATOR_MARKER]: { next: FunctionRef; return: FunctionRef; stream?: boolean } };
type BlobRef = { [BLOB_MARKER]: { type: string; bytes: Uint8Array } };
type AbortReason = { error: SerializedBackendError } | { value: unknown };
type SignalRef = {
  [SIGNAL_MARKER]: { aborted: true; reason: AbortReason } | { aborted: false; onAbort: FunctionRef };
};

const encodeReason = (reason: unknown): AbortReason => {
  if (reason instanceof Error) return { error: serializeBackendError(reason) };
  try {
    return { value: structuredClone(reason) };
  } catch {
    return { error: serializeBackendError(reason) };
  }
};

const decodeReason = (reason: AbortReason) =>
  "error" in reason ? deserializeBackendError(reason.error) : reason.value;

const setData = (copy: Record<string, unknown>, key: string, value: unknown) => {
  if (key === "__proto__") {
    Object.defineProperty(copy, key, { value, enumerable: true, writable: true, configurable: true });
  } else copy[key] = value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPlainObject = (value: object) => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const isFunctionRef = (value: unknown): value is FunctionRef =>
  isRecord(value) && typeof value[FUNCTION_MARKER] === "string";
const isIteratorRef = (value: unknown): value is IteratorRef =>
  isRecord(value) &&
  isRecord(value[ITERATOR_MARKER]) &&
  isFunctionRef(value[ITERATOR_MARKER].next) &&
  isFunctionRef(value[ITERATOR_MARKER].return);
const isSignalRef = (value: unknown): value is SignalRef =>
  isRecord(value) &&
  isRecord(value[SIGNAL_MARKER]) &&
  (value[SIGNAL_MARKER].aborted === true
    ? isRecord(value[SIGNAL_MARKER].reason)
    : value[SIGNAL_MARKER].aborted === false && isFunctionRef(value[SIGNAL_MARKER].onAbort));

const isAsyncIterable = (value: object): value is AsyncIterable<unknown> => Symbol.asyncIterator in value;

const isBlobRef = (value: unknown): value is BlobRef =>
  isRecord(value) && isRecord(value[BLOB_MARKER]) && value[BLOB_MARKER].bytes instanceof Uint8Array;

// Read byte data without copying the object graph or invoking an iterable before export.
const readBlobs = async (value: unknown) => {
  const blobs = new Set<Blob>();
  const seen = new Set<object>();
  const visit = (entry: unknown) => {
    if (entry instanceof Blob) {
      blobs.add(entry);
      return;
    }
    if (entry === null || typeof entry !== "object" || seen.has(entry) || isAsyncIterable(entry)) return;
    if (!Array.isArray(entry) && !isPlainObject(entry)) return;
    seen.add(entry);
    for (const child of Object.values(entry)) visit(child);
  };
  visit(value);
  return new Map(
    await Promise.all([...blobs].map(async (blob) => [blob, new Uint8Array(await blob.arrayBuffer())] as const)),
  );
};

export const createFunctionTable = () => {
  const functions = new Map<string, { fn: RemoteFunction; cleanup: boolean }>();
  const disposers = new Set<() => unknown>();
  const handles = new WeakMap<object, RemoteFunction>();
  let next = 0;

  const register = (fn: RemoteFunction, cleanup = false): FunctionRef => {
    const id = `f${next++}`;
    functions.set(id, { fn, cleanup });
    return { [FUNCTION_MARKER]: id };
  };

  const dispose = () => {
    for (const close of disposers) {
      try {
        void Promise.resolve(close()).catch(() => {});
      } catch {}
    }
    disposers.clear();
  };

  const exportIterable = (iterable: AsyncIterable<unknown>): IteratorRef => {
    const iterator = iterable[Symbol.asyncIterator]();
    let done = false;
    const finish = () => {
      done = true;
      disposers.delete(close);
    };
    const close = (value?: unknown) => {
      if (done) return { done: true, value };
      finish();
      return iterator.return?.(value) ?? { done: true, value };
    };
    disposers.add(close);
    return {
      [ITERATOR_MARKER]: {
        stream: iterable instanceof ReadableStream,
        next: register(async () => {
          if (done) return { done: true, value: undefined };
          const result = await iterator.next();
          if (done) return { done: true, value: undefined };
          if (result.done) finish();
          return result;
        }),
        return: register(close, true),
      },
    };
  };

  const exportSignal = (signal: AbortSignal): SignalRef => ({
    [SIGNAL_MARKER]: signal.aborted
      ? { aborted: true, reason: encodeReason(signal.reason) }
      : {
          aborted: false,
          onAbort: register((listener) => {
            if (typeof listener !== "function") return;
            const detach = () => {
              signal.removeEventListener("abort", notify);
              disposers.delete(detach);
            };
            const notify = () => {
              detach();
              void Promise.resolve()
                .then(() => listener(encodeReason(signal.reason)))
                .catch(() => {});
            };
            if (signal.aborted) notify();
            else {
              disposers.add(detach);
              signal.addEventListener("abort", notify, { once: true });
            }
          }),
        },
  });

  const exportClose = (owner: object, close: RemoteFunction) => {
    let finish = handles.get(owner);
    if (!finish) {
      let closing = false;
      finish = () => {
        if (closing) return;
        closing = true;
        disposers.delete(finish!);
        return close.call(owner);
      };
      handles.set(owner, finish);
      disposers.add(finish);
    }
    return register(finish, true);
  };

  const exportPlain = (value: object, blobs: Map<Blob, Uint8Array>, seen: WeakMap<object, unknown>) => {
    if (Array.isArray(value)) {
      const copy: unknown[] = [];
      seen.set(value, copy);
      for (const entry of value) copy.push(exportSync(entry, blobs, seen));
      return copy;
    }
    if (MARKERS.some((marker) => marker in value))
      throw new TypeError(`Values sent to or from an extension backend cannot use the keys ${MARKERS.join(", ")}.`);
    const copy: Record<string, unknown> = {};
    seen.set(value, copy);
    for (const [key, entry] of Object.entries(value)) {
      const exported =
        key === "close" && typeof entry === "function"
          ? exportClose(value, entry as RemoteFunction)
          : exportSync(entry, blobs, seen);
      setData(copy, key, exported);
    }
    return copy;
  };

  /** Replaces this side's functions, iterables and signals with references. Other data is cloned. */
  const exportSync = (value: unknown, blobs: Map<Blob, Uint8Array>, seen = new WeakMap<object, unknown>()): unknown => {
    if (typeof value === "function") return register(value as RemoteFunction);
    if (value === null || typeof value !== "object") return value;
    if (value instanceof AbortSignal) return exportSignal(value);
    if (seen.has(value)) return seen.get(value);
    if (value instanceof Blob) {
      const bytes = blobs.get(value);
      if (!bytes) throw new TypeError("Blob changed during extension backend export.");
      const reference = { [BLOB_MARKER]: { type: value.type, bytes } } satisfies BlobRef;
      seen.set(value, reference);
      return reference;
    }
    if (isAsyncIterable(value)) return exportIterable(value);
    return Array.isArray(value) || isPlainObject(value) ? exportPlain(value, blobs, seen) : value;
  };

  const exportValue = async (value: unknown) => exportSync(value, await readBlobs(value));

  const call = async (id: string, args: () => unknown[], cleanupOnly = false) => {
    const entry = functions.get(id);
    if (!entry || (cleanupOnly && !entry.cleanup)) throw new Error("This function is no longer available.");
    return entry.fn(...args());
  };

  const clear = () => {
    functions.clear();
    dispose();
  };

  return { exportValue, call, clear, dispose };
};

/** A host operation can produce a reader or handle after its caller has departed. */
export const discardValue = (value: unknown) => {
  const table = createFunctionTable();
  // Exporting registers the value's closers; clearing the table runs them.
  void table
    .exportValue(value)
    .catch(() => {})
    .finally(() => table.clear());
};

/** Replaces references from the other side with stubs that call back through `invoke`. */
export const importValue = (
  value: unknown,
  invoke: (id: string, args: unknown[]) => Promise<unknown>,
  seen = new WeakMap<object, unknown>(),
): unknown => {
  if (isFunctionRef(value))
    return (...args: unknown[]) => {
      const result = invoke(value[FUNCTION_MARKER], args);
      // A listener stub is often called without being awaited; its failure must not crash its caller's process.
      result.catch(() => {});
      return result;
    };
  if (isIteratorRef(value)) {
    const { next, return: finish } = value[ITERATOR_MARKER];
    const iterator: AsyncIterator<unknown> = {
      next: () => invoke(next[FUNCTION_MARKER], []) as Promise<IteratorResult<unknown>>,
      return: (result?: unknown) => invoke(finish[FUNCTION_MARKER], [result]) as Promise<IteratorResult<unknown>>,
    };
    if (!value[ITERATOR_MARKER].stream) return { [Symbol.asyncIterator]: () => iterator };
    return new ReadableStream({
      async pull(controller) {
        const result = await iterator.next();
        if (result.done) controller.close();
        else controller.enqueue(result.value);
      },
      cancel: async () => {
        await iterator.return?.();
      },
    });
  }
  if (isBlobRef(value)) {
    if (seen.has(value)) return seen.get(value);
    const { type, bytes } = value[BLOB_MARKER];
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type });
    seen.set(value, blob);
    return blob;
  }
  if (isSignalRef(value)) {
    const controller = new AbortController();
    const signal = value[SIGNAL_MARKER];
    if (signal.aborted) controller.abort(decodeReason(signal.reason));
    else
      invoke(signal.onAbort[FUNCTION_MARKER], [(reason: AbortReason) => controller.abort(decodeReason(reason))]).catch(
        () => {},
      );
    return controller.signal;
  }
  if (value === null || typeof value !== "object") return value;
  if (!Array.isArray(value) && !isPlainObject(value)) return value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const entry of value) copy.push(importValue(entry, invoke, seen));
    return copy;
  }
  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  for (const [key, entry] of Object.entries(value)) setData(copy, key, importValue(entry, invoke, seen));
  return copy;
};
