import { EventEmitter } from "node:events";
import type { EventStore, JsonPatch } from "pstdio-api-contracts";

const DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const PATCH_EVENT = "patch";
const CLOSE_EVENT = "close";

type EventStoreOptions = {
  maxSizeBytes?: number;
};

export const createEventStore = (options?: EventStoreOptions) => {
  const maxSize = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const history: JsonPatch[] = [];
  const patchSizes: number[] = [];
  const emitter = new EventEmitter();
  let totalSize = 0;
  let closed = false;

  emitter.setMaxListeners(100);

  const evict = () => {
    while (totalSize > maxSize && history.length > 0) {
      history.shift();
      totalSize -= patchSizes.shift()!;
    }
  };

  const push = (patch: JsonPatch) => {
    if (closed) return;

    const size = Buffer.byteLength(JSON.stringify(patch));

    history.push(patch);
    patchSizes.push(size);
    totalSize += size;

    evict();

    emitter.emit(PATCH_EVENT, patch, size);
  };

  const getHistory = () => [...history];

  const subscribe = (): AsyncIterable<JsonPatch> => ({
    [Symbol.asyncIterator]: () => {
      const queue: { patch: JsonPatch; size: number }[] = [];
      let queuedBytes = 0;
      let resolve: ((value: IteratorResult<JsonPatch>) => void) | null = null;
      let done = closed;

      const onPatch = (patch: JsonPatch, size: number) => {
        if (resolve) {
          const r = resolve;
          resolve = null;
          r({ value: patch, done: false });
        } else {
          queue.push({ patch, size });
          queuedBytes += size;
        }
      };

      onPatch.diagnostics = () => ({ events: queue.length, bytes: queuedBytes });

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
            queuedBytes -= entry.size;
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
            return Promise.resolve({ value: history[historyIndex++], done: false });
          }

          return liveIterator.next();
        },

        return: () => liveIterator.return!(undefined as never),
      };
    },
  });

  const snapshotAndSubscribe = () => {
    const historySnapshot = [...history];
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
      historyBytes: totalSize,
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
