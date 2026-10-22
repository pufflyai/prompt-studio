import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";

const collectionWrites = new Set(["put", "update", "delete", "create", "createIfAbsent", "deleteIfValue"]);

// Counts every write a caller asks for, including writes that leave the stored data unchanged.
export const countStorageWrites = (storage: ExtensionStorageApi) => {
  const counter = { writes: 0 };
  const counted = <T extends object>(target: T, writes: Set<string>, wrap?: (key: string, value: unknown) => unknown) =>
    new Proxy(target, {
      get(object, key) {
        const value = Reflect.get(object, key);
        if (typeof value !== "function") return value;
        const name = String(key);
        return (...args: unknown[]) => {
          if (writes.has(name)) counter.writes += 1;
          const result = value.apply(object, args);
          return wrap ? wrap(name, result) : result;
        };
      },
    });
  const wrapStorage = (scope: ExtensionStorageApi): ExtensionStorageApi =>
    counted(scope, new Set(["set", "delete"]), (name, result) => {
      if (name === "collection") return counted(result as object, collectionWrites);
      if (name === "scope") return wrapStorage(result as ExtensionStorageApi);
      return result;
    });
  return { storage: wrapStorage(storage), counter };
};
