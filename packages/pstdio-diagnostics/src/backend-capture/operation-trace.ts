import { channel } from "node:diagnostics_channel";
import type { BackendOperationEvent, BackendOperationTrace } from "pstdio-api-contracts/extension-kernel";
import { runtimeOperationChannel } from "../runtime-operation";

const MAX_EVENTS = 1000;
const MAX_BYTES = 512 * 1024;
const MAX_AGE_MS = 60_000;
const stringFields = ["id", "parentId", "queryHash", "statement", "caller", "sessionId"] as const;
const numberFields = ["rows", "bytes", "logicalBytes", "wireBytes", "fragments", "revision"] as const;

const readOrigin = (input: unknown) => {
  if (!input || typeof input !== "object") return;
  const origin = input as Record<string, unknown>;
  if (typeof origin.kind !== "string" || typeof origin.name !== "string") return;
  const value: NonNullable<BackendOperationEvent["origin"]> = {
    kind: origin.kind.slice(0, 32),
    name: origin.name.slice(0, 256),
  };
  if (typeof origin.id === "string") value.id = origin.id.slice(0, 128);
  if (typeof origin.projectId === "string") value.projectId = origin.projectId.slice(0, 128);
  return value;
};

// Any code in the process can publish to Node channels. Copy only the documented bounded metadata.
const readOperation = (value: unknown) => {
  if (!value || typeof value !== "object") return;
  const input = value as Record<string, unknown>;
  if (typeof input.kind !== "string" || typeof input.startedAt !== "string" || typeof input.durationMs !== "number")
    return;
  if (!Number.isFinite(Date.parse(input.startedAt)) || !Number.isFinite(input.durationMs) || input.durationMs < 0)
    return;
  const event: BackendOperationEvent = {
    kind: input.kind.slice(0, 64),
    startedAt: input.startedAt.slice(0, 64),
    durationMs: input.durationMs,
  };
  for (const field of stringFields) {
    const entry = input[field];
    if (typeof entry === "string") event[field] = entry.slice(0, 2048);
  }
  for (const field of numberFields) {
    const entry = input[field];
    if (typeof entry === "number" && Number.isFinite(entry) && entry >= 0) event[field] = entry;
  }
  if (typeof input.failed === "boolean") event.failed = input.failed;
  if (typeof input.complete === "boolean") event.complete = input.complete;
  const origin = readOrigin(input.origin);
  if (origin) event.origin = origin;
  return event;
};

/** Retains the host operations published while a capture runs. Call `close` when it ends. */
export const collectOperationTrace = () => {
  const source = channel(runtimeOperationChannel);
  const entries = new Map<string | symbol, { event: BackendOperationEvent; bytes: number; observedAt: number }>();
  let bytes = 0;
  let dropped = 0;
  const trim = () => {
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const [key, entry] of entries) {
      if (entries.size <= MAX_EVENTS && bytes <= MAX_BYTES && entry.observedAt >= cutoff) break;
      entries.delete(key);
      bytes -= entry.bytes;
      dropped++;
    }
  };
  const observe = (message: unknown) => {
    // Subscriber failures must never escape into the operation being diagnosed.
    try {
      const event = readOperation(message);
      if (!event) return;
      const size = Buffer.byteLength(JSON.stringify(event));
      const key = typeof event.id === "string" ? event.id : Symbol();
      const previous = entries.get(key);
      if (previous) {
        bytes -= previous.bytes;
        entries.delete(key);
      }
      entries.set(key, { event, bytes: size, observedAt: Date.now() });
      bytes += size;
      trim();
    } catch {
      dropped++;
    }
  };
  source.subscribe(observe);
  return {
    snapshot(): BackendOperationTrace {
      trim();
      return {
        channel: runtimeOperationChannel,
        events: [...entries.values()].map((entry) => entry.event),
        dropped,
        bytes,
      };
    },
    close: () => source.unsubscribe(observe),
  };
};
