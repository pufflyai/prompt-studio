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
  const pending = new Map<AbortController, Promise<void>>();
  return {
    run: (channel: HarnessAuthenticationChannel, invoke: (channel: HarnessAuthenticationChannel) => Promise<void>) => {
      const controller = new AbortController();
      const signal = AbortSignal.any([controller.signal, channel.signal]);
      const operation = Promise.resolve().then(() =>
        invoke({
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
        }),
      );
      pending.set(controller, operation);
      const done = () => pending.delete(controller);
      void operation.then(done, done);
      return operation;
    },
    dispose: async () => {
      for (const controller of pending.keys()) controller.abort();
      await Promise.allSettled(pending.values());
    },
  };
};
