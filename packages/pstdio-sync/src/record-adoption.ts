import diff from "fast-diff";
import { canonicalJson, type Json, type RecordEdit, type SharedEdit, type StorageRecord } from "pstdio-sync-contracts";

type JsonObject = { [key: string]: Json };
const same = (left: Json | undefined, right: Json | undefined) =>
  canonicalJson(left ?? null) === canonicalJson(right ?? null);
const isObject = (value: Json | undefined): value is JsonObject =>
  !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Three-way merge of JSON values. A change either side made since `base` survives; where both
 * sides changed the same value, the local one wins. Without a base, differing values keep local.
 */
export const mergeJson = (base: Json | undefined, local: Json, remote: Json): Json => {
  if (same(local, remote)) return remote;
  if (base !== undefined && same(base, local)) return remote;
  if (base !== undefined && same(base, remote)) return local;
  if (!isObject(local) || !isObject(remote)) return local;
  return mergeObjects(isObject(base) ? base : undefined, local, remote);
};

const mergeObjects = (base: JsonObject | undefined, local: JsonObject, remote: JsonObject) => {
  const merged: JsonObject = {};
  for (const key of new Set([...Object.keys(remote), ...Object.keys(local)])) {
    const previous = base && Object.hasOwn(base, key) ? base[key] : undefined;
    if (Object.hasOwn(local, key) && Object.hasOwn(remote, key))
      merged[key] = mergeJson(previous, local[key]!, remote[key]!);
    // Remote removed a key that local left alone: the removal survives.
    else if (Object.hasOwn(local, key)) {
      if (previous === undefined || !same(previous, local[key])) merged[key] = local[key]!;
    }
    // Local removed the key: the local removal wins.
    else if (previous === undefined) merged[key] = remote[key]!;
  }
  return merged;
};

const recordJson = (record: StorageRecord) =>
  ({
    deleted: record.deleted,
    value: record.value,
    asset: record.asset as Json,
    shared: record.shared as Json,
  }) satisfies JsonObject;

const sharedEdits = (remote: StorageRecord["shared"], target: StorageRecord["shared"]) => {
  // A record's shared kind is fixed once set, and shared values cannot be removed by an edit.
  if (!target || (remote && remote.kind !== target.kind) || same(remote?.value, target.value)) return [];
  if (target.kind === "text") {
    const edits: SharedEdit[] = [];
    let index = 0;
    for (const [operation, text] of diff((remote?.value as string | undefined) ?? "", target.value)) {
      if (operation === diff.INSERT) edits.push({ kind: "text.insert", index, text });
      if (operation === diff.DELETE) edits.push({ kind: "text.delete", index, count: text.length });
      else index += text.length;
    }
    return edits;
  }
  if (target.kind === "list") {
    const count = ((remote?.value as Json[] | undefined) ?? []).length;
    return [
      ...(count ? [{ kind: "list.delete", index: 0, count } satisfies SharedEdit] : []),
      { kind: "list.insert", index: 0, values: target.value },
    ] satisfies SharedEdit[];
  }
  const before = (remote?.value as JsonObject | undefined) ?? {};
  const after = target.value as JsonObject;
  return [
    ...Object.keys(before)
      .filter((key) => !Object.hasOwn(after, key))
      .map((key) => ({ kind: "map.delete", key }) satisfies SharedEdit),
    ...Object.entries(after)
      .filter(([key, value]) => !same(before[key], value))
      .map(([key, value]) => ({ kind: "map.set", key, value }) satisfies SharedEdit),
  ];
};

/**
 * The edit that adds this device's changes to a record another device synced first. `base` is the
 * record as this device first saved it in its own document, when that state is still known.
 */
export const adoptionEdit = (base: StorageRecord | undefined, local: StorageRecord, remote: StorageRecord) => {
  const target = mergeJson(base && recordJson(base), recordJson(local), recordJson(remote)) as ReturnType<
    typeof recordJson
  >;
  if (same(target, recordJson(remote))) return null;
  if (target.deleted)
    return remote.deleted ? null : ({ recordId: remote.recordId, deleted: true } satisfies RecordEdit);
  const shared = sharedEdits(remote.shared, target.shared as StorageRecord["shared"]);
  const edit: RecordEdit = {
    recordId: remote.recordId,
    ...(remote.deleted && { deleted: false }),
    ...((remote.deleted || !same(target.value, remote.value)) && { replace: target.value }),
    ...(!same(target.asset, remote.asset) && { asset: target.asset as StorageRecord["asset"] }),
    ...(shared.length && { shared }),
  };
  return edit;
};
