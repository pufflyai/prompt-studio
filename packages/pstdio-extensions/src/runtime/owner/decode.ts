import { deferredValue } from "./deferred-value";
import { restoreLocalValue } from "./local-values";
import type { WireValue } from "./protocol";
export const createOwnerDecoder = (
  call: (handle: string, args: unknown[]) => Promise<unknown>,
  signals: Map<string, AbortController>,
) => {
  const decode = (value: WireValue, disposers?: Set<() => void>): unknown => {
    if (value === null || typeof value !== "object") return value;
    switch (value.type) {
      case "undefined":
        return undefined;
      case "local":
        return restoreLocalValue(decode(value.value) as Parameters<typeof restoreLocalValue>[0]);
      case "bytes":
        return new Uint8Array(value.values);
      case "array":
        return value.values.map((item) => decode(item, disposers));
      case "object":
        return Object.fromEntries(value.values.map(([key, item]) => [key, decode(item, disposers)]));
      case "function":
        return (...args: unknown[]) => deferredValue(call(value.id, args));
      case "promise": {
        const promise = call(value.id, []);
        void promise.catch(() => {});
        return promise;
      }
      case "signal": {
        const controller = new AbortController();
        if (value.aborted) controller.abort();
        signals.set(value.id, controller);
        disposers?.add(() => {
          controller.abort();
          signals.delete(value.id);
        });
        return controller.signal;
      }
      case "iterator":
        return {
          async *[Symbol.asyncIterator]() {
            try {
              while (true) {
                const next = (await call(value.id, ["next"])) as IteratorResult<unknown>;
                if (next.done) return;
                yield next.value;
              }
            } finally {
              await call(value.id, ["return"]);
            }
          },
        };
      default:
        throw new Error("Invalid extension bridge value.");
    }
  };
  return decode;
};
