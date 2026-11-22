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
const MARKERS = [FUNCTION_MARKER, ITERATOR_MARKER, SIGNAL_MARKER];

type RemoteFunction = (...args: unknown[]) => unknown;
type FunctionRef = { [FUNCTION_MARKER]: string };
type IteratorRef = { [ITERATOR_MARKER]: { next: FunctionRef; return: FunctionRef } };
type SignalRef = { [SIGNAL_MARKER]: { aborted: boolean; onAbort: FunctionRef } };

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
  isRecord(value) && isRecord(value[SIGNAL_MARKER]) && isFunctionRef(value[SIGNAL_MARKER].onAbort);

const isAsyncIterable = (value: object): value is AsyncIterable<unknown> => Symbol.asyncIterator in value;

export const createFunctionTable = () => {
  const functions = new Map<string, RemoteFunction>();
  const iterators = new Set<AsyncIterator<unknown>>();
  let next = 0;

  const register = (fn: RemoteFunction): FunctionRef => {
    const id = `f${next++}`;
    functions.set(id, fn);
    return { [FUNCTION_MARKER]: id };
  };

  const exportIterable = (iterable: AsyncIterable<unknown>): IteratorRef => {
    const iterator = iterable[Symbol.asyncIterator]();
    iterators.add(iterator);
    return {
      [ITERATOR_MARKER]: {
        next: register(() => iterator.next()),
        return: register(async (value?: unknown) => {
          iterators.delete(iterator);
          return (await iterator.return?.(value)) ?? { done: true, value };
        }),
      },
    };
  };

  const exportSignal = (signal: AbortSignal): SignalRef => ({
    [SIGNAL_MARKER]: {
      aborted: signal.aborted,
      onAbort: register((listener) => {
        const notify = () => void Promise.resolve((listener as () => unknown)()).catch(() => {});
        if (signal.aborted) notify();
        else signal.addEventListener("abort", notify, { once: true });
      }),
    },
  });

  const exportPlain = (value: object, seen: WeakMap<object, unknown>) => {
    if (Array.isArray(value)) {
      const copy: unknown[] = [];
      seen.set(value, copy);
      for (const entry of value) copy.push(exportValue(entry, seen));
      return copy;
    }
    if (MARKERS.some((marker) => marker in value))
      throw new TypeError(`Values sent to or from an extension backend cannot use the keys ${MARKERS.join(", ")}.`);
    const copy: Record<string, unknown> = {};
    seen.set(value, copy);
    for (const [key, entry] of Object.entries(value)) copy[key] = exportValue(entry, seen);
    return copy;
  };

  /** Replaces this side's functions, iterables and signals with references. Other data is cloned. */
  const exportValue = (value: unknown, seen = new WeakMap<object, unknown>()): unknown => {
    if (typeof value === "function") return register(value as RemoteFunction);
    if (value === null || typeof value !== "object") return value;
    if (value instanceof AbortSignal) return exportSignal(value);
    if (seen.has(value)) return seen.get(value);
    if (isAsyncIterable(value)) return exportIterable(value);
    return Array.isArray(value) || isPlainObject(value) ? exportPlain(value, seen) : value;
  };

  const call = async (id: string, args: unknown[]) => {
    const fn = functions.get(id);
    if (!fn) throw new Error("This function is no longer available.");
    return fn(...args);
  };

  /** Ends the invocation's references and releases the readers of any iterator left open. */
  const clear = () => {
    functions.clear();
    for (const iterator of iterators) void Promise.resolve(iterator.return?.()).catch(() => {});
    iterators.clear();
  };

  return { exportValue, call, clear };
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
    return { [Symbol.asyncIterator]: () => iterator };
  }
  if (isSignalRef(value)) {
    const controller = new AbortController();
    const { aborted, onAbort } = value[SIGNAL_MARKER];
    if (aborted) controller.abort();
    else invoke(onAbort[FUNCTION_MARKER], [() => controller.abort()]).catch(() => {});
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
  for (const [key, entry] of Object.entries(value)) copy[key] = importValue(entry, invoke, seen);
  return copy;
};
