import { applyConversationPatch, normalizeConversationPatch } from "pstdio-api-contracts";
import {
  type AbortReason,
  BLOB_MARKER,
  decodeReason,
  type EventSink,
  FUNCTION_MARKER,
  ITERATOR_MARKER,
  type IteratorRef,
  isBlobRef,
  isFunctionRef,
  isIteratorRef,
  isPlainObject,
  isPromiseRef,
  isSignalRef,
  isSinkRef,
  PROMISE_MARKER,
  SIGNAL_MARKER,
  SINK_MARKER,
  type SignalRef,
  type SinkRef,
  setData,
} from "./remote-markers";
import type { createImportTracker } from "./remote-values";

type ImportTracker = ReturnType<typeof createImportTracker>;
type Invoke = (id: string, args: unknown[], keepAbortListener?: boolean) => Promise<unknown>;

const signalControllers = new WeakMap<AbortSignal, AbortController>();
const pendingIterators = new WeakMap<Promise<unknown>, AsyncIterator<unknown>>();

const abortImportedSignal = (target: WeakRef<AbortSignal>) => (reason: AbortReason) => {
  const signal = target.deref();
  if (!signal) return;
  signalControllers.get(signal)?.abort(decodeReason(reason));
  signalControllers.delete(signal);
};

const importSink = (ref: SinkRef, invoke: Invoke, tracker?: ImportTracker) => {
  const { push } = ref[SINK_MARKER];
  let messages = [...ref[SINK_MARKER].messages];
  const sink: EventSink = {
    push(patch) {
      messages = applyConversationPatch(messages, normalizeConversationPatch(patch));
      invoke(push[FUNCTION_MARKER], [patch]).catch(() => {});
    },
    getMessages: () => [...messages],
  };
  tracker?.track(sink, [push[FUNCTION_MARKER]]);
  return sink;
};

const importIterator = (ref: IteratorRef, invoke: Invoke, tracker?: ImportTracker) => {
  const { next, return: finish, stream } = ref[ITERATOR_MARKER];
  const read = (id: string, args: unknown[]) => {
    const pending = invoke(id, args) as Promise<IteratorResult<unknown>>;
    // Retain the iterator for a pending read even when the caller drops the iterator itself.
    pendingIterators.set(pending, iterator);
    const complete = () => pendingIterators.delete(pending);
    void pending.then(complete, complete);
    return pending;
  };
  const iterator: AsyncIterator<unknown> = {
    next: () => read(next[FUNCTION_MARKER], []),
    return: (result?: unknown) => read(finish[FUNCTION_MARKER], [result]),
  };
  const imported: object = stream
    ? new ReadableStream({
        async pull(controller) {
          const result = await iterator.next();
          if (result.done) controller.close();
          else controller.enqueue(result.value);
        },
        cancel: async () => {
          await iterator.return?.();
        },
      })
    : { [Symbol.asyncIterator]: () => iterator };
  // The iterator, not its wrapper: a reader can keep only the iterator, as lazyIterable does, and
  // the wrapper and the stream both hold it, so it lives exactly as long as anything can read.
  tracker?.track(iterator, [next[FUNCTION_MARKER], finish[FUNCTION_MARKER]]);
  return imported;
};

const importSignal = (ref: SignalRef, invoke: Invoke, tracker?: ImportTracker) => {
  const controller = new AbortController();
  const signal = ref[SIGNAL_MARKER];
  const imported = controller.signal;
  if (signal.aborted) controller.abort(decodeReason(signal.reason));
  else {
    const { onAbort } = signal;
    // The remote subscription may outlive the initial handler. Keep the callback, but let the
    // signal be collected when the receiver no longer holds it so the subscription can detach.
    signalControllers.set(imported, controller);
    invoke(onAbort[FUNCTION_MARKER], [abortImportedSignal(new WeakRef(imported))], true).catch(() => {});
    tracker?.track(imported, [onAbort[FUNCTION_MARKER]]);
  }
  return imported;
};

const importReference = (value: unknown, invoke: Invoke, tracker?: ImportTracker) => {
  if (isFunctionRef(value)) {
    const stub = (...args: unknown[]) => {
      const result = invoke(value[FUNCTION_MARKER], args);
      // A listener stub is often called without being awaited; its failure must not crash its caller's process.
      result.catch(() => {});
      return result;
    };
    tracker?.track(stub, [value[FUNCTION_MARKER]]);
    return stub;
  }
  if (isPromiseRef(value)) {
    const settled = invoke(value[PROMISE_MARKER][FUNCTION_MARKER], []);
    settled.catch(() => {});
    tracker?.track(settled, [value[PROMISE_MARKER][FUNCTION_MARKER]]);
    return settled;
  }
  if (isSinkRef(value)) return importSink(value, invoke, tracker);
  if (isIteratorRef(value)) return importIterator(value, invoke, tracker);
  if (isSignalRef(value)) return importSignal(value, invoke, tracker);
  if (isBlobRef(value)) {
    const { type, bytes } = value[BLOB_MARKER];
    return new Blob([bytes as Uint8Array<ArrayBuffer>], { type });
  }
  return undefined;
};

/** Replaces references from the other side with stubs that call back through `invoke`. */
export const importValue = (
  value: unknown,
  invoke: Invoke,
  tracker?: ImportTracker,
  seen = new WeakMap<object, unknown>(),
): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  const reference = importReference(value, invoke, tracker);
  if (reference !== undefined) {
    seen.set(value, reference);
    return reference;
  }
  if (!Array.isArray(value) && !isPlainObject(value)) return value;
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const entry of value) copy.push(importValue(entry, invoke, tracker, seen));
    return copy;
  }
  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  for (const [key, entry] of Object.entries(value)) setData(copy, key, importValue(entry, invoke, tracker, seen));
  return copy;
};
