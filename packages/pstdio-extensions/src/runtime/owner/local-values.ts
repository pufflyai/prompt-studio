import { createStorageId, createStorageMigration, createStoragePositions } from "pstdio-api-contracts";

const descriptor = Symbol.for("pstdio.owner.local-value");
type LocalValue =
  | { kind: "storage-id" }
  | { kind: "storage-positions"; deviceId: string }
  | { kind: "storage-migration"; namespace: Array<string | number> }
  | { kind: "command-result"; result: string }
  | { kind: "url"; template: string }
  | { kind: "unsupported"; operation: string };

const describe = <T extends object>(value: T, data: LocalValue) =>
  Object.defineProperty(value, descriptor, { value: data });
export const readLocalValue = (value: unknown) => {
  if (value === createStorageId) return { kind: "storage-id" } satisfies LocalValue;
  if (value !== null && (typeof value === "object" || typeof value === "function"))
    return Reflect.get(value, descriptor) as LocalValue | undefined;
  return undefined;
};
export const restoreLocalValue = (value: LocalValue): unknown => {
  switch (value.kind) {
    case "storage-id":
      return createStorageId;
    case "storage-positions":
      return createStoragePositions(value.deviceId);
    case "storage-migration":
      return createStorageMigration(value.namespace);
    case "command-result":
      return (input?: unknown) => {
        if (value.result === "continue") return { type: "continue" };
        if (value.result === "reject") return { type: "reject", ...(input as object) };
        if (value.result === "replaceInvocation") return { type: value.result, invocation: input };
        if (value.result === "patchParams" || value.result === "replaceParams")
          return { type: value.result, params: input };
        throw new Error("Unsupported extension command helper.");
      };
    case "url":
      return (id: string) => value.template.replaceAll("PSTDIO_REMOTE_ID", encodeURIComponent(id));
    case "unsupported":
      return () => {
        throw new Error(`Extension owner protocol does not yet support ${value.operation}.`);
      };
  }
  throw new Error("Invalid extension local-value descriptor.");
};

const prepareStorage = (storage: Record<string, unknown>): Record<string, unknown> => {
  if (readLocalValue(storage)) return storage;
  return Object.fromEntries(
    Object.entries(storage).map(([key, value]) => {
      if (typeof value !== "function")
        return [key, value && typeof value === "object" ? prepareStorage(value as Record<string, unknown>) : value];
      if (["scope", "collection", "attachments"].includes(key))
        return [key, (...args: unknown[]) => prepareStorage(value.apply(storage, args))];
      if (key === "urlFor")
        return [key, describe(value.bind(storage), { kind: "url", template: value.call(storage, "PSTDIO_REMOTE_ID") })];
      return [key, readLocalValue(value) ? value : value.bind(storage)];
    }),
  );
};

export const prepareOwnerContext = (context: Record<string, unknown>) => {
  const result = { ...context };
  if (context.storage && typeof context.storage === "object")
    result.storage = prepareStorage(context.storage as Record<string, unknown>);
  if (context.commands && typeof context.commands === "object")
    result.commands = Object.fromEntries(
      Object.entries(context.commands).map(([key, value]) => {
        if (key === "execute" || typeof value !== "function") return [key, value];
        return [key, describe(value.bind(context.commands), { kind: "command-result", result: key })];
      }),
    );
  if (context.terminal)
    result.terminal = { openSession: describe(() => {}, { kind: "unsupported", operation: "terminal.openSession" }) };
  return result;
};
