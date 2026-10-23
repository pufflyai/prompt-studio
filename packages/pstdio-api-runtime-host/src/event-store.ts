import { EventEmitter } from "node:events";
import type { EventStore, JsonPatch } from "pstdio-api-contracts";

const DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const PATCH_EVENT = "patch";
const CLOSE_EVENT = "close";

type EventStoreOptions = {
  maxSizeBytes?: number;
};

interface StoredPatch {
  patch: JsonPatch;
  size: number;
  byteEnd: bigint;
}

const byteLength = (entries: StoredPatch[]) => {
  const first = entries[0];
  const last = entries.at(-1);
  return first && last ? Number(last.byteEnd - first.byteEnd) + first.size : 0;
};

export const createEventStore = (options?: EventStoreOptions) => {
  const maxSize = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const history: StoredPatch[] = [];
  const emitter = new EventEmitter();
  // History retention and subscriber spans share one functional byte address.
  // Keep it monotonic even when an oversized patch empties retained history.
  let byteEnd = 0n;
  let closed = false;

  emitter.setMaxListeners(100);

  const evict = () => {
    while (byteLength(history) > maxSize && history.length > 0) {
      history.shift();
    }
  };

  const push = (patch: JsonPatch) => {
    if (closed) return;

    const size = Buffer.byteLength(JSON.stringify(patch));

    byteEnd += BigInt(size);
    const entry = { patch, size, byteEnd };
    history.push(entry);

    evict();

    emitter.emit(PATCH_EVENT, entry);
  };

  const getHistory = () => history.map((entry) => entry.patch);

  const subscribe = (): AsyncIterable<JsonPatch> => ({
    [Symbol.asyncIterator]: () => {
      const queue: StoredPatch[] = [];
      let resolve: ((value: IteratorResult<JsonPatch>) => void) | null = null;
      let done = closed;

      const onPatch = (entry: StoredPatch) => {
        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ value: entry.patch, done: false });
        } else {
          queue.push(entry);
        }
      };

      onPatch.diagnostics = () => ({ events: queue.length, bytes: byteLength(queue) });

      const onClose = () => {
        done = true;
        emitter.off(PATCH_EVENT, onPatch);
        emitter.off(CLOSE_EVENT, onClose);

        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ value: undefined as never, done: true });
        }
      };

      if (!done) {
        emitter.on(PATCH_EVENT, onPatch);
        emitter.on(CLOSE_EVENT, onClose);
      }

      return {
        next: () => {
          if (queue.length > 0) {
            const entry = queue.shift()!;
            return Promise.resolve({ value: entry.patch, done: false });
          }

          if (done) {
            return Promise.resolve({ value: undefined as never, done: true });
          }

          return new Promise<IteratorResult<JsonPatch>>((r) => {
            resolve = r;
          });
        },

        return: () => {
          onClose();
          return Promise.resolve({ value: undefined as never, done: true });
        },
      };
    },
  });

  const historyPlusStream = (): AsyncIterable<JsonPatch> => ({
    [Symbol.asyncIterator]: () => {
      const historySnapshot = history.length;
      let historyIndex = 0;
      const liveIterator = subscribe()[Symbol.asyncIterator]();

      return {
        next: () => {
          if (historyIndex < historySnapshot) {
            return Promise.resolve({ value: history[historyIndex++]?.patch, done: false });
          }

          return liveIterator.next();
        },

        return: () => liveIterator.return!(undefined as never),
      };
    },
  });

  const snapshotAndSubscribe = () => {
    const historySnapshot = getHistory();
    const liveIterator = subscribe()[Symbol.asyncIterator]();

    return {
      history: historySnapshot,
      stream: {
        [Symbol.asyncIterator]: () => liveIterator,
      },
    };
  };

  const close = () => {
    closed = true;
    emitter.emit(CLOSE_EVENT);
    emitter.removeAllListeners();
  };

  const diagnostics = () => {
    const subscribers = emitter.listeners(PATCH_EVENT) as Array<
      (() => void) & { diagnostics: () => { events: number; bytes: number } }
    >;
    let queuedEvents = 0;
    let queuedBytes = 0;
    for (const subscriber of subscribers) {
      const queue = subscriber.diagnostics();
      queuedEvents += queue.events;
      queuedBytes += queue.bytes;
    }
    return {
      historyEvents: history.length,
      historyBytes: byteLength(history),
      subscribers: subscribers.length,
      queuedEvents,
      queuedBytes,
    };
  };
  return {
    push,
    getHistory,
    subscribe,
    historyPlusStream,
    snapshotAndSubscribe,
    close,
    diagnostics,
  } satisfies EventStore & { close(): void; diagnostics(): unknown };
};
