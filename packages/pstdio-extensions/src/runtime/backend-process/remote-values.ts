/**
 * Functions, async iterables and abort signals that cross the worker boundary inside an invocation.
 * The side that owns one keeps it in its table and sends a reference; the other side gets a stub
 * that calls back. Tables belong to one invocation and are cleared when it settles.
 *
 * Only plain objects and arrays are walked. Their own function properties are the deliberate API
 * of a handle, such as `{ close() }`. Class instances, maps, URLs and other objects cross as cloned
 * data, so a host object's methods and internals never become callable by accident.
 */

import type { JsonPatch } from "pstdio-api-contracts";
import {
  BLOB_MARKER,
  type BlobRef,
  type EventSink,
  encodeReason,
  FUNCTION_MARKER,
  type FunctionRef,
  ITERATOR_MARKER,
  type IteratorRef,
  isAsyncIterable,
  isCleanupFunction,
  isPlainObject,
  MARKERS,
  PROMISE_MARKER,
  type RemoteFunction,
  SIGNAL_MARKER,
  SINK_MARKER,
  type SignalRef,
  SNAPSHOT_SINK,
  setData,
} from "./remote-markers";

export { importValue } from "./remote-imports";
export { snapshotSink } from "./remote-markers";

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

type ExportState = {
  blobs: Map<Blob, Uint8Array>;
  seen: WeakMap<object, unknown>;
  refs: Set<string>;
  exportedIterators: WeakSet<object>;
};

const closeSafely = (close: () => unknown) => {
  try {
    void Promise.resolve(close()).catch(() => {});
  } catch {}
};

export const createFunctionTable = () => {
  const functions = new Map<string, { fn: RemoteFunction; cleanup: boolean; reserve: boolean }>();
  const pinned = new Set<string>();
  const resultReferences = new Set<string>();
  const disposers = new Map<() => unknown, Set<string>>();
  const handles = new WeakMap<object, RemoteFunction>();
  let next = 0;
  let closed = false;
  let resultKeepsReferences: boolean | undefined;

  const register = (state: ExportState, fn: RemoteFunction, cleanup = false): FunctionRef => {
    const id = `f${next++}`;
    functions.set(id, { fn, cleanup, reserve: cleanup || isCleanupFunction(fn) });
    state.refs.add(id);
    return { [FUNCTION_MARKER]: id };
  };

  const own = (close: () => unknown, ...references: FunctionRef[]) => {
    const ids = disposers.get(close) ?? new Set<string>();
    for (const reference of references) ids.add(reference[FUNCTION_MARKER]);
    disposers.set(close, ids);
  };

  const disposeUnused = () => {
    for (const [close, ids] of disposers) {
      for (const id of ids) if (!functions.has(id)) ids.delete(id);
      if (ids.size) continue;
      disposers.delete(close);
      closeSafely(close);
    }
  };

  const dispose = () => {
    for (const close of disposers.keys()) closeSafely(close);
    disposers.clear();
  };

  const exportIterable = (iterable: AsyncIterable<unknown>, state: ExportState): IteratorRef => {
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
    const advance = register(state, async () => {
      if (done) return { done: true, value: undefined };
      const result = await iterator.next();
      if (done) return { done: true, value: undefined };
      if (result.done) finish();
      return result;
    });
    const end = register(state, close, true);
    own(close, advance, end);
    state.exportedIterators.add(iterable);
    return { [ITERATOR_MARKER]: { stream: iterable instanceof ReadableStream, next: advance, return: end } };
  };

  const exportSignal = (signal: AbortSignal, state: ExportState): SignalRef => {
    if (signal.aborted) return { [SIGNAL_MARKER]: { aborted: true, reason: encodeReason(signal.reason) } };
    const onAbort = register(state, (listener) => {
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
        own(detach, onAbort);
        signal.addEventListener("abort", notify, { once: true });
      }
    });
    return { [SIGNAL_MARKER]: { aborted: false, onAbort } };
  };

  const exportClose = (owner: object, close: RemoteFunction, state: ExportState) => {
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
    }
    const ref = register(state, finish, true);
    own(finish, ref);
    return ref;
  };

  const exportPlain = (value: object, state: ExportState) => {
    if (Array.isArray(value)) {
      const copy: unknown[] = [];
      state.seen.set(value, copy);
      for (const entry of value) copy.push(exportSync(entry, state));
      return copy;
    }
    if (MARKERS.some((marker) => marker in value))
      throw new TypeError(`Values sent to or from an extension backend cannot use the keys ${MARKERS.join(", ")}.`);
    const copy: Record<string, unknown> = {};
    state.seen.set(value, copy);
    for (const [key, entry] of Object.entries(value)) {
      const exported =
        key === "close" && typeof entry === "function"
          ? exportClose(value, entry as RemoteFunction, state)
          : exportSync(entry, state);
      setData(copy, key, exported);
    }
    return copy;
  };

  const exportSpecial = (value: object, state: ExportState) => {
    if (value instanceof Blob) {
      const bytes = state.blobs.get(value);
      if (!bytes) throw new TypeError("Blob changed during extension backend export.");
      return { [BLOB_MARKER]: { type: value.type, bytes } } satisfies BlobRef;
    }
    if (value instanceof AbortSignal) return exportSignal(value, state);
    if (value instanceof Promise) return { [PROMISE_MARKER]: register(state, () => value) };
    if (SNAPSHOT_SINK in value) {
      const sink = (value as { [SNAPSHOT_SINK]: EventSink })[SNAPSHOT_SINK];
      const push = register(state, (patch) => sink.push(patch as JsonPatch));
      return { [SINK_MARKER]: { messages: [...sink.getMessages()], push } };
    }
    if (isAsyncIterable(value)) return exportIterable(value, state);
    return undefined;
  };

  const exportSync = (value: unknown, state: ExportState): unknown => {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
    if (state.seen.has(value)) return state.seen.get(value);
    const special = exportSpecial(value, state);
    if (special !== undefined) {
      state.seen.set(value, special);
      return special;
    }
    if (typeof value === "function") return register(state, value as RemoteFunction);
    return Array.isArray(value) || isPlainObject(value) ? exportPlain(value, state) : value;
  };

  const release = (ids: Iterable<string>) => {
    for (const id of ids) {
      functions.delete(id);
      pinned.delete(id);
      resultReferences.delete(id);
    }
    disposeUnused();
  };

  const retainExport = (ids: ReadonlySet<string>, pin: boolean | "with-result") => {
    if (!pin || !ids.size) return;
    let retained = pinned;
    if (pin === "with-result") {
      if (resultKeepsReferences === false) throw new Error("The invocation has finished.");
      if (resultKeepsReferences === undefined) retained = resultReferences;
    }
    for (const id of ids) retained.add(id);
  };

  const exportResult = async (value: unknown, pin: boolean | "with-result" = false, discardOnFailure = false) => {
    const state: ExportState = {
      blobs: new Map(),
      seen: new WeakMap(),
      refs: new Set(),
      exportedIterators: new WeakSet(),
    };
    try {
      if (closed) throw new Error("The invocation has finished.");
      state.blobs = await readBlobs(value);
      if (closed) throw new Error("The invocation has finished.");
      const exported = exportSync(value, state);
      retainExport(state.refs, pin);
      return { value: exported, kept: state.refs };
    } catch (error) {
      release(state.refs);
      if (discardOnFailure) discardValue(value, (owner) => handles.has(owner) || state.exportedIterators.has(owner));
      throw error;
    }
  };

  const exportValue = async (value: unknown) => (await exportResult(value)).value;

  const exportPinned = async (value: unknown) => (await exportResult(value, true)).value;

  const call = async (id: string, args: () => unknown[], cleanupOnly = false) => {
    const entry = functions.get(id);
    if (!entry || (cleanupOnly && !entry.cleanup)) throw new Error("This function is no longer available.");
    return entry.fn(...args());
  };

  const seal = (kept: ReadonlySet<string> = new Set(), keepResultReferences = false) => {
    resultKeepsReferences = keepResultReferences;
    if (keepResultReferences) for (const id of resultReferences) pinned.add(id);
    resultReferences.clear();
    for (const id of functions.keys()) if (!kept.has(id) && !pinned.has(id)) functions.delete(id);
    disposeUnused();
  };

  const clear = () => {
    closed = true;
    functions.clear();
    pinned.clear();
    resultReferences.clear();
    dispose();
  };

  return {
    exportValue,
    exportResult,
    exportPinned,
    isPinned: (id: string) => pinned.has(id),
    // Capacity for cleanups does not change which references a cancelled invocation can use.
    usesCleanupReserve: (id: string) => functions.get(id)?.reserve === true,
    call,
    dispose,
    release,
    seal,
    clear,
    get size() {
      return functions.size;
    },
  };
};

/** Close returned readers and handles when their invocation no longer has a caller. */
export const discardValue = (value: unknown, alreadyManaged: (owner: object) => boolean = () => false) => {
  const seen = new WeakSet<object>();
  const visit = (entry: unknown) => {
    if (!entry || (typeof entry !== "object" && typeof entry !== "function") || seen.has(entry)) return;
    seen.add(entry);
    try {
      if (isAsyncIterable(entry)) {
        if (alreadyManaged(entry)) return;
        const iterator = entry[Symbol.asyncIterator]();
        closeSafely(() => iterator.return?.());
        return;
      }
      if (!Array.isArray(entry) && !isPlainObject(entry)) return;
      const close = Object.getOwnPropertyDescriptor(entry, "close")?.value;
      if (typeof close === "function" && !alreadyManaged(entry)) closeSafely(() => close.call(entry));
      const properties = Object.values(Object.getOwnPropertyDescriptors(entry));
      for (const property of properties.filter((property) => property.enumerable && "value" in property))
        visit(property.value);
    } catch {}
  };
  visit(value);
};

/**
 * Counts the other side's references this side still holds. When a stub becomes unreachable,
 * its owner is told so it can drop the function. A session handle therefore keeps its worker
 * functions exactly as long as the host keeps the handle.
 */
export const createImportTracker = (onRelease: (ids: string[]) => void) => {
  let live = 0;
  const registry = new FinalizationRegistry<string[]>((ids) => {
    live -= 1;
    onRelease(ids);
  });
  return {
    track(holder: object, ids: string[]) {
      live += 1;
      registry.register(holder, ids);
    },
    get live() {
      return live;
    },
  };
};
