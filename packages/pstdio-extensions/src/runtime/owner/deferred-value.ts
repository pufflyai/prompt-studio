// Synchronous context factories (collection, scope, mount) return objects whose
// operations are asynchronous. Preserve that shape while the factory crosses IPC.
export const deferredValue = (value: Promise<unknown>): unknown => {
  void value.catch(() => {});
  return new Proxy(() => {}, {
    get: (_target, key) => {
      if (key === "then") return value.then.bind(value);
      if (key === "catch") return value.catch.bind(value);
      if (key === "finally") return value.finally.bind(value);
      if (key === Symbol.asyncIterator)
        return async function* () {
          const iterable = (await value) as AsyncIterable<unknown>;
          yield* iterable;
        };
      return deferredValue(
        value.then((resolved) => {
          if (!resolved || (typeof resolved !== "object" && typeof resolved !== "function"))
            throw new Error("Extension remote value has no properties.");
          const member = Reflect.get(resolved, key);
          return typeof member === "function" ? member.bind(resolved) : member;
        }),
      );
    },
    apply: (_target, _receiver, args) =>
      deferredValue(
        value.then((resolved) => {
          if (typeof resolved !== "function") throw new Error("Extension remote value is not callable.");
          return resolved(...args);
        }),
      ),
  });
};
