import type { WebviewEditingChange } from "pstdio-api-contracts/extension-kernel";

/** Absolute field patches compose without retaining every pointer/input event. */
export const mergeEditingPreview = (previous: WebviewEditingChange[], changes: WebviewEditingChange[]) => {
  let merged = previous;
  for (const change of changes) {
    merged = merged.filter((older) => !change.path.every((key, index) => older.path[index] === key));
    merged.push(structuredClone(change));
  }
  return merged;
};

/** One actual optional RPC plus one replaceable latest intent; required commands never wait here. */
export const createEditingPreviewQueue = <Input>(send: (input: Input) => Promise<void>) => {
  let running = false;
  let closed = false;
  let queued: { input: Input; settled: ReturnType<typeof Promise.withResolvers<void>> } | undefined;
  const pump = () => {
    if (running || closed || !queued) return;
    const current = queued;
    queued = undefined;
    running = true;
    void send(current.input)
      .then(current.settled.resolve, current.settled.reject)
      .finally(() => {
        running = false;
        pump();
      });
  };
  const clear = () => {
    queued?.settled.resolve();
    queued = undefined;
  };
  return {
    enqueue(input: Input) {
      if (closed) return Promise.reject(new Error("editing_session_closed"));
      clear();
      const settled = Promise.withResolvers<void>();
      queued = { input, settled };
      pump();
      return settled.promise;
    },
    clear,
    dispose() {
      closed = true;
      clear();
    },
  };
};
