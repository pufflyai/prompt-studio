import type { HarnessProvider } from "pstdio-api-contracts/extension-kernel";
import type { HarnessCallOptions, HarnessContextFactory, HarnessHandle } from "./harness-registry";

export const createHarnessCommandObservations = (
  provider: HarnessProvider,
  context: (options?: HarnessCallOptions) => ReturnType<HarnessContextFactory>,
  disposed: () => boolean,
) => {
  const stops = new Set<() => void>();
  const pending = new Set<Promise<() => void>>();
  const watch: HarnessHandle["watchCommandState"] = provider.watchCommandState
    ? (input, changed, options) => {
        const work = (async () => {
          const release = await provider.watchCommandState!(await context(options), input, changed);
          let closed = false;
          const close = () => {
            if (closed) return;
            closed = true;
            stops.delete(close);
            release();
          };
          if (disposed()) close();
          else stops.add(close);
          return close;
        })();
        pending.add(work);
        void work.finally(() => pending.delete(work)).catch(() => {});
        return work;
      }
    : undefined;
  return {
    watch,
    async dispose() {
      const installs = await Promise.allSettled([...pending]);
      const releases = await Promise.allSettled([...stops].map((close) => Promise.resolve().then(close)));
      const errors = [...installs, ...releases].flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (errors.length) throw new AggregateError(errors, "Harness command observation cleanup failed");
    },
  };
};
