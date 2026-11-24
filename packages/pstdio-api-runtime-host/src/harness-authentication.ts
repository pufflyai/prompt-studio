import type { HarnessAuthenticationChannel } from "pstdio-api-contracts";

const abortable = <T>(work: Promise<T>, signal: AbortSignal) => {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
};

/** Provider retirement owns account flows just as it owns native sessions. */
export const createHarnessAuthenticationLifetime = () => {
  const lifetime = new AbortController();
  // Each running flow with the function that stops the children it started.
  const pending = new Map<Promise<void>, () => void>();
  return {
    run: (
      channel: HarnessAuthenticationChannel,
      invoke: (channel: HarnessAuthenticationChannel) => Promise<void>,
      stopChildren: () => void = () => {},
    ) => {
      if (lifetime.signal.aborted) return Promise.reject(lifetime.signal.reason);
      const signal = AbortSignal.any([lifetime.signal, channel.signal]);
      const operation = Promise.resolve().then(() => {
        signal.throwIfAborted();
        return invoke({
          ...channel,
          signal,
          request: (prompt) => {
            signal.throwIfAborted();
            return abortable(channel.request(prompt), signal);
          },
          emit: async (prompt) => {
            signal.throwIfAborted();
            await channel.emit(prompt);
          },
        });
      });
      pending.set(operation, stopChildren);
      const done = () => pending.delete(operation);
      void operation.then(done, done);
      return operation;
    },
    dispose: async () => {
      lifetime.abort();
      // A flow that awaits its own child would otherwise wait for a child nobody stops yet.
      for (const stop of pending.values()) stop();
      await Promise.allSettled(pending.keys());
    },
  };
};
