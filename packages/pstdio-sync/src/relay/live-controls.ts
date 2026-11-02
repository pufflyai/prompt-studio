import type { LiveClientMessage, LiveControlMessage, LiveServerMessage } from "pstdio-sync-contracts";

type Entry = { message: LiveControlMessage; remove: LiveControlMessage; count: number };
const different = (source: Map<string, Entry>, target: Map<string, Entry>) => {
  for (const entry of source) if (target.get(entry[0]) !== entry[1]) return entry;
};

/** Reconcile routing state one acknowledged operation at a time; never retain live payloads. */
export const createLiveControls = (
  send: (message: LiveClientMessage) => boolean,
  refused: () => void,
  accepted: (message: LiveControlMessage) => void,
) => {
  const desired = new Map<string, Entry>();
  const applied = new Map<string, Entry>();
  let connected = false;
  let pending: { requestId: string; key: string; entry: Entry; adding: boolean } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (!connected || pending || timer) return;
    // Remove retired state first, including when replacing a full subscription set.
    const removed = different(applied, desired);
    const next = removed ?? different(desired, applied);
    if (!next) return;
    const [key, entry] = next;
    pending = { requestId: crypto.randomUUID(), key, entry, adding: !removed };
    if (!send({ ...(removed ? entry.remove : entry.message), requestId: pending.requestId })) pending = undefined;
  };
  const reset = () => {
    connected = false;
    clearTimeout(timer);
    timer = undefined;
    pending = undefined;
    applied.clear();
  };
  return {
    reset,
    ready() {
      reset();
      connected = true;
      flush();
    },
    result(event: Extract<LiveServerMessage, { type: "control-result" }>) {
      if (!pending || pending.requestId !== event.requestId) return;
      const previous = pending;
      pending = undefined;
      if (event.retryAfterMs === null) {
        reset();
        refused();
      } else if (event.retryAfterMs > 0) {
        timer = setTimeout(() => {
          timer = undefined;
          flush();
        }, event.retryAfterMs);
      } else {
        if (previous.adding) {
          applied.set(previous.key, previous.entry);
          accepted(previous.entry.message);
        } else applied.delete(previous.key);
        flush();
      }
    },
    retain(key: string, message: LiveControlMessage, remove: LiveControlMessage) {
      const existing = desired.get(key);
      const entry = existing ?? { message, remove, count: 0 };
      entry.count++;
      desired.set(key, entry);
      if (applied.get(key) === entry)
        queueMicrotask(() => {
          if (desired.get(key) === entry && applied.get(key) === entry) accepted(entry.message);
        });
      flush();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        if (--entry.count === 0) desired.delete(key);
        flush();
      };
    },
  };
};
