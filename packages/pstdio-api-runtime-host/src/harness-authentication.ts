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
  const pending = new Set<Promise<void>>();
  return {
    run: (channel: HarnessAuthenticationChannel, invoke: (channel: HarnessAuthenticationChannel) => Promise<void>) => {
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
      pending.add(operation);
      const done = () => pending.delete(operation);
      void operation.then(done, done);
      return operation;
    },
    dispose: async () => {
      lifetime.abort();
      await Promise.allSettled(pending);
    },
  };
};
