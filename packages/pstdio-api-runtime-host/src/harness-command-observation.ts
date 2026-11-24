import type { HarnessProvider } from "pstdio-api-contracts/extension-kernel";
import type { createHarnessCallOwnership } from "./harness-process-ownership";
import type { HarnessHandle } from "./harness-registry";

export const createHarnessCommandObservations = (
  provider: HarnessProvider,
  openCall: ReturnType<typeof createHarnessCallOwnership>["open"],
  disposed: () => boolean,
) => {
  const stops = new Set<() => void>();
  const pending = new Map<Promise<() => void>, AbortController>();
  const watch: HarnessHandle["watchCommandState"] = provider.watchCommandState
    ? (input, changed, options) => {
        const controller = new AbortController();
        const work = (async () => {
          const call = await openCall(options, { ...input, signal: controller.signal });
          try {
            const release = await provider.watchCommandState!(call.context, input, changed);
            let closed = false;
            const close = () => {
              if (closed) return;
              closed = true;
              stops.delete(close);
              try {
                release();
              } finally {
                call.close();
              }
            };
            if (disposed()) close();
            else stops.add(close);
            return close;
          } catch (error) {
            call.close();
            throw error;
          }
        })();
        pending.set(work, controller);
        void work.finally(() => pending.delete(work)).catch(() => {});
        return work;
      }
    : undefined;
  return {
    watch,
    async dispose() {
      const installing = [...pending];
      for (const [, controller] of installing) controller.abort();
      const installs = await Promise.allSettled(installing.map(([work]) => work));
      const releases = await Promise.allSettled([...stops].map((close) => Promise.resolve().then(close)));
      const errors = [...installs, ...releases].flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (errors.length) throw new AggregateError(errors, "Harness command observation cleanup failed");
    },
  };
};
