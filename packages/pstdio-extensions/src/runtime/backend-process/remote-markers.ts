import type { JsonPatch, SessionMessage } from "pstdio-api-contracts";
import { deserializeBackendError, type SerializedBackendError, serializeBackendError } from "./protocol";

export const FUNCTION_MARKER = "$pstdioFunction";
export const ITERATOR_MARKER = "$pstdioIterator";
export const SIGNAL_MARKER = "$pstdioSignal";
export const BLOB_MARKER = "$pstdioBlob";
export const PROMISE_MARKER = "$pstdioPromise";
export const SINK_MARKER = "$pstdioSink";
export const MARKERS = [FUNCTION_MARKER, ITERATOR_MARKER, SIGNAL_MARKER, BLOB_MARKER, PROMISE_MARKER, SINK_MARKER];

export type EventSink = { push(patch: JsonPatch): void; getMessages(): readonly SessionMessage[] };
export const SNAPSHOT_SINK = Symbol("pstdio.snapshotSink");

/**
 * Marks a harness event sink. Its `getMessages()` is synchronous, so the other side receives the
 * current messages and applies its own pushes to them locally while forwarding each push in order.
 */
export const snapshotSink = (sink: EventSink) => ({ [SNAPSHOT_SINK]: sink });

/** Harness method and operation inputs both carry the same synchronous event sink. */
export const withSnapshotSinks = (arg: unknown) => {
  const events = (arg as { events?: Partial<EventSink> } | null)?.events;
  if (typeof events?.push !== "function" || typeof events.getMessages !== "function") return arg;
  return { ...(arg as object), events: snapshotSink(events as EventSink) };
};

export type RemoteFunction = (...args: unknown[]) => unknown;
export type FunctionRef = { [FUNCTION_MARKER]: string };
export type IteratorRef = { [ITERATOR_MARKER]: { next: FunctionRef; return: FunctionRef; stream?: boolean } };
export type BlobRef = { [BLOB_MARKER]: { type: string; bytes: Uint8Array } };
export type PromiseRef = { [PROMISE_MARKER]: FunctionRef };
export type SinkRef = { [SINK_MARKER]: { messages: SessionMessage[]; push: FunctionRef } };
export type AbortReason = { error: SerializedBackendError } | { value: unknown };
export type SignalRef = {
  [SIGNAL_MARKER]: { aborted: true; reason: AbortReason } | { aborted: false; onAbort: FunctionRef };
};

export const encodeReason = (reason: unknown) => {
  if (reason instanceof Error) return { error: serializeBackendError(reason) };
  try {
    return { value: structuredClone(reason) };
  } catch {
    return { error: serializeBackendError(reason) };
  }
};

export const decodeReason = (reason: AbortReason) =>
  "error" in reason ? deserializeBackendError(reason.error) : reason.value;

export const setData = (copy: Record<string, unknown>, key: string, value: unknown) => {
  if (key === "__proto__") {
    Object.defineProperty(copy, key, { value, enumerable: true, writable: true, configurable: true });
  } else copy[key] = value;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isPlainObject = (value: object) => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export const isFunctionRef = (value: unknown): value is FunctionRef =>
  isRecord(value) && typeof value[FUNCTION_MARKER] === "string";
export const isIteratorRef = (value: unknown): value is IteratorRef =>
  isRecord(value) &&
  isRecord(value[ITERATOR_MARKER]) &&
  isFunctionRef(value[ITERATOR_MARKER].next) &&
  isFunctionRef(value[ITERATOR_MARKER].return);
export const isSignalRef = (value: unknown): value is SignalRef =>
  isRecord(value) &&
  isRecord(value[SIGNAL_MARKER]) &&
  (value[SIGNAL_MARKER].aborted === true
    ? isRecord(value[SIGNAL_MARKER].reason)
    : value[SIGNAL_MARKER].aborted === false && isFunctionRef(value[SIGNAL_MARKER].onAbort));

export const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
  value !== null &&
  (typeof value === "object" || typeof value === "function") &&
  typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function";
export const isPromiseRef = (value: unknown): value is PromiseRef =>
  isRecord(value) && isFunctionRef(value[PROMISE_MARKER]);
export const isSinkRef = (value: unknown): value is SinkRef =>
  isRecord(value) &&
  isRecord(value[SINK_MARKER]) &&
  Array.isArray(value[SINK_MARKER].messages) &&
  isFunctionRef(value[SINK_MARKER].push);

export const isBlobRef = (value: unknown): value is BlobRef =>
  isRecord(value) && isRecord(value[BLOB_MARKER]) && value[BLOB_MARKER].bytes instanceof Uint8Array;
