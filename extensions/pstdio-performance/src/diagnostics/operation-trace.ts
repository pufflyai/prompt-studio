import { channel } from "node:diagnostics_channel";

const MAX_EVENTS = 1000;
const MAX_BYTES = 512 * 1024;
const MAX_AGE_MS = 60_000;
const stringFields = ["kind", "startedAt", "id", "parentId", "queryHash", "statement", "caller", "sessionId"] as const;
const numberFields = ["durationMs", "rows", "bytes", "logicalBytes", "wireBytes", "fragments", "revision"] as const;

interface OperationEvent {
  kind: string;
  startedAt: string;
  durationMs: number;
  origin?: { kind: string; name: string; id?: string; projectId?: string };
  [key: string]: unknown;
}

const readOrigin = (input: unknown) => {
  if (!input || typeof input !== "object") return;
  const origin = input as Record<string, unknown>;
  if (typeof origin.kind !== "string" || typeof origin.name !== "string") return;
  const value: NonNullable<OperationEvent["origin"]> = {
    kind: origin.kind.slice(0, 32),
    name: origin.name.slice(0, 256),
  };
  if (typeof origin.id === "string") value.id = origin.id.slice(0, 128);
  if (typeof origin.projectId === "string") value.projectId = origin.projectId.slice(0, 128);
  return value;
};

// A local extension can publish to Node channels. Copy only the documented bounded metadata.
const readOperation = (value: unknown) => {
  if (!value || typeof value !== "object") return;
  const input = value as Record<string, unknown>;
  if (typeof input.kind !== "string" || typeof input.startedAt !== "string" || typeof input.durationMs !== "number")
    return;
  if (!Number.isFinite(Date.parse(input.startedAt)) || !Number.isFinite(input.durationMs) || input.durationMs < 0)
    return;
  const event: OperationEvent = {
    kind: input.kind.slice(0, 64),
    startedAt: input.startedAt.slice(0, 64),
    durationMs: input.durationMs,
  };
  for (const field of stringFields) {
    if (typeof input[field] === "string") event[field] = input[field].slice(0, 2048);
  }
  for (const field of numberFields) {
    if (typeof input[field] === "number" && Number.isFinite(input[field]) && input[field] >= 0)
      event[field] = input[field];
  }
  if (typeof input.failed === "boolean") event.failed = input.failed;
  if (typeof input.complete === "boolean") event.complete = input.complete;
  event.origin = readOrigin(input.origin);
  return event;
};

export const collectOperationTrace = () => {
  const source = channel("pstdio.diagnostics.operation");
  const entries = new Map<string | symbol, { event: OperationEvent; bytes: number; observedAt: number }>();
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
    snapshot() {
      trim();
      return {
        channel: "pstdio.diagnostics.operation",
        events: [...entries.values()].map((entry) => entry.event),
        dropped,
        bytes,
      };
    },
    close: () => source.unsubscribe(observe),
  };
};
