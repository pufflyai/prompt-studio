import type { Json, SharedEdit, StorageRecord } from "pstdio-sync-contracts";

type Shared = StorageRecord["shared"];
const sequenceEdit = (shared: Shared, input: Exclude<SharedEdit, { kind: "map.set" | "map.delete" }>) => {
  const kind = input.kind.split(".")[0]!;
  const value = shared?.value ?? (kind === "text" ? "" : []);
  const length = (value as string | Json[]).length;
  const count = "count" in input ? input.count : 0;
  if (
    !Number.isSafeInteger(input.index) ||
    input.index < 0 ||
    input.index > length ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    input.index + count > length
  )
    throw new Error("Shared edit is outside the current sequence");
  if (input.kind === "text.insert" || input.kind === "text.delete")
    return {
      kind: "text" as const,
      value:
        (value as string).slice(0, input.index) +
        (input.kind === "text.insert" ? input.text : "") +
        (value as string).slice(input.index + count),
    };
  const list = [...(value as Json[])];
  list.splice(input.index, count, ...(input.kind === "list.insert" ? input.values : []));
  return { kind: "list" as const, value: list };
};

/** Compatibility inputs are explicit intent; maintained map/list callers migrate to plain paths. */
export const editOrderedShared = (before: Shared, inputs: SharedEdit[]) => {
  let shared = structuredClone(before);
  for (const input of inputs) {
    const kind = input.kind.split(".")[0]!;
    if (shared && shared.kind !== kind) throw new Error("One shared primitive per record");
    if (input.kind !== "map.set" && input.kind !== "map.delete") {
      shared = sequenceEdit(shared, input);
      continue;
    }
    const value = { ...(shared?.value as Record<string, Json> | undefined) };
    if (input.kind === "map.set")
      Object.defineProperty(value, input.key, {
        value: input.value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    else delete value[input.key];
    shared = { kind: "map", value };
  }
  return shared;
};
