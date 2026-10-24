import {
  canonicalJson,
  type Json,
  type SharedEdit,
  type StorageGroup,
  type StorageRecord,
} from "pstdio-sync-contracts";

/** The part of a record that a recovery point keeps. */
export type RecoveryRecord = Pick<StorageRecord, "recordId" | "value" | "asset" | "shared">;
type Edit = StorageGroup["edits"][number];

const same = (left: unknown, right: unknown) => canonicalJson(left as Json) === canonicalJson(right as Json);

// Keep the unchanged start and end so concurrent edits elsewhere in the sequence still merge.
const changedRange = <T>(current: T[], target: T[]) => {
  let start = 0;
  while (start < current.length && start < target.length && same(current[start], target[start])) start++;
  let end = 0;
  while (
    end < current.length - start &&
    end < target.length - start &&
    same(current[current.length - 1 - end], target[target.length - 1 - end])
  )
    end++;
  return { start, removed: current.length - start - end, inserted: target.slice(start, target.length - end) };
};

const sharedEdits = (current: StorageRecord["shared"], target: StorageRecord["shared"]) => {
  const kind = target?.kind ?? current?.kind;
  // A record keeps one shared primitive for its lifetime, so a different kind cannot be restored.
  if (!kind || (current && target && current.kind !== target.kind)) return [];
  if (kind === "map") {
    const from = (current?.value ?? {}) as Record<string, Json>;
    const to = (target?.value ?? {}) as Record<string, Json>;
    return [
      ...Object.keys(from)
        .filter((key) => !Object.hasOwn(to, key))
        .map((key): SharedEdit => ({ kind: "map.delete", key })),
      ...Object.entries(to)
        .filter(([key, value]) => !Object.hasOwn(from, key) || !same(from[key], value))
        .map(([key, value]): SharedEdit => ({ kind: "map.set", key, value })),
    ];
  }
  if (kind === "text") {
    const from = (current?.value ?? "") as string;
    const to = (target?.value ?? "") as string;
    // Compare whole code points so no edit splits a surrogate pair; Yjs indexes count UTF-16 units.
    const characters = Array.from(from);
    const { start, removed, inserted } = changedRange(characters, Array.from(to));
    const index = characters.slice(0, start).join("").length;
    const count = characters.slice(start, start + removed).join("").length;
    return [
      ...(count ? [{ kind: "text.delete" as const, index, count }] : []),
      ...(inserted.length ? [{ kind: "text.insert" as const, index, text: inserted.join("") }] : []),
    ];
  }
  const { start, removed, inserted } = changedRange((current?.value ?? []) as Json[], (target?.value ?? []) as Json[]);
  return [
    ...(removed ? [{ kind: "list.delete" as const, index: start, count: removed }] : []),
    ...(inserted.length ? [{ kind: "list.insert" as const, index: start, values: inserted }] : []),
  ];
};

/**
 * Edits that turn the current live records into the saved ones. A revived record keeps the old
 * shared state of its document, so its shared edits wait until it is live again (`revived`).
 */
export const recoveryEdits = (current: RecoveryRecord[], saved: RecoveryRecord[]) => {
  const now = new Map(current.map((record) => [record.recordId, record]));
  const target = new Map(saved.map((record) => [record.recordId, record]));
  const ids = [...new Set([...now.keys(), ...target.keys()])].sort();
  const edits: Edit[] = [];
  let revived = false;
  for (const recordId of ids) {
    const from = now.get(recordId);
    const to = target.get(recordId);
    if (!to) {
      edits.push({ recordId, deleted: true });
      continue;
    }
    if (!from) {
      revived = true;
      edits.push({ recordId, deleted: false, replace: to.value, asset: to.asset });
      continue;
    }
    const edit: Edit = { recordId };
    if (!same(from.value, to.value)) edit.replace = to.value;
    if (!same(from.asset, to.asset)) edit.asset = to.asset;
    const shared = sharedEdits(from.shared, to.shared);
    if (shared.length) edit.shared = shared;
    if (Object.keys(edit).length > 1) edits.push(edit);
  }
  return { edits, revived };
};
