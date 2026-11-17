import { fingerprint, type Json } from "pstdio-sync-contracts";
import { collectionMoveMarkerId, collectionRecordPrefix, storageRecordId } from "./namespaces";
import type { OrderedBase } from "./ordered-base";
import { isOrderedMoveOperation, type OrderedRecordMove, prepareOrderedMove } from "./ordered-move";
import {
  type OrderedEdit,
  type OrderedOperation,
  type OrderedRecord,
  prepareOrderedOperation,
} from "./ordered-operation";
import { orderedBody } from "./ordered-projection";

type Reader = (ids: string[]) => Promise<ReadonlyMap<string, OrderedRecord>>;
type Prepared = { operation: OrderedOperation; identity: string };

const parts = (recordId: string) => {
  try {
    const value = JSON.parse(recordId) as unknown;
    return Array.isArray(value) && value.every((part) => typeof part === "string") ? (value as string[]) : undefined;
  } catch {
    return undefined;
  }
};
const collectionItem = (recordId: string) => {
  const value = parts(recordId);
  if (value?.length !== 5 || value[2] !== "collection") return undefined;
  return { scopeType: value[0]!, scopeId: value[1]!, name: value[3]!, itemId: value[4]! };
};
const collectionMarker = (recordId: string) => {
  const value = parts(recordId);
  if (value?.length !== 4 || value[2] !== "collection-moved") return undefined;
  return { scopeType: value[0]!, scopeId: value[1]!, name: value[3]! };
};

const live = (record: OrderedRecord | undefined): record is OrderedRecord => !!record && !record.deleted;

/** Whether a lifetime stamp names a host collection move, either pending or in relay order. */
const writtenByMove = (lifetime: string) => {
  const stamp = parts(lifetime);
  // Canonical stamps are ["canonical", epoch, operationId]; pending ones ["pending", operationId, fingerprint].
  const operationId = stamp?.[0] === "pending" ? stamp[1] : stamp?.[2];
  return stamp?.[0] !== "initial" && !!operationId && isOrderedMoveOperation({ operationId });
};

const keyPrefixes = async (canonical: Reader, collections: { scopeType: string; scopeId: string; name: string }[]) => {
  const ids = [...new Set(collections.map((item) => collectionMoveMarkerId(item.scopeType, item.scopeId, item.name)))];
  const markers = await canonical(ids);
  return (scopeType: string, scopeId: string, name: string) => {
    const marker = markers.get(collectionMoveMarkerId(scopeType, scopeId, name));
    const keyPrefix = live(marker)
      ? (orderedBody(marker).value as { keyPrefix?: unknown } | null)?.keyPrefix
      : undefined;
    return typeof keyPrefix === "string" ? keyPrefix : undefined;
  };
};

/**
 * Old collection items that a move deleted, with the record each moved to. The base describes the
 * record as the move left it, so a forwarded write loses to any edit saved there after the move.
 */
const displacedTargets = async (operation: OrderedOperation, canonical: Reader) => {
  const items = operation.edits.flatMap((edit) => {
    const item = collectionItem(edit.recordId);
    return item ? [{ recordId: edit.recordId, ...item }] : [];
  });
  const targets = new Map<string, { to: string; base: OrderedBase }>();
  if (!items.length) return targets;
  const prefixFor = await keyPrefixes(canonical, items);
  const moved = new Map<string, string>();
  for (const item of items) {
    const prefix = prefixFor(item.scopeType, item.scopeId, item.name);
    if (prefix !== undefined)
      moved.set(item.recordId, storageRecordId([item.scopeType, item.scopeId, "kv"], prefix + item.itemId));
  }
  const records = await canonical([...moved.keys(), ...moved.values()]);
  for (const [from, to] of moved) {
    const old = records.get(from);
    const target = records.get(to);
    if (!old?.deleted || !writtenByMove(old.lifetime) || !live(target)) continue;
    const base = { version: 1, exists: true, deleted: false, lifetime: target.lifetime, stamps: { "": old.lifetime } };
    targets.set(from, { to, base: base as OrderedBase });
  }
  return targets;
};

/** Old-format body changes unwrapped from the `{ value, sortOrder }` envelope; other channels are dropped. */
const unwrappedChanges = (changes: OrderedOperation["edits"][number]["changes"]) =>
  changes.flatMap((change) => {
    const [body, field, ...rest] = change.path;
    if (body !== "value") return [];
    if (field === undefined) {
      if (!("set" in change)) return [];
      const set = change.set as { value?: Json } | null;
      return [{ path: ["value"], set: set && typeof set === "object" ? (set.value ?? null) : null }];
    }
    return field === "value" ? [{ ...change, path: ["value", ...rest] }] : [];
  });

/**
 * Re-author this device's own save that relay order refused or skipped because a collection move
 * deleted its items. Other refusals, and moves themselves, are not forwarded.
 */
export const forwardDisplacedSave = async (input: {
  operation: OrderedOperation;
  refused: boolean;
  skipped: ReadonlySet<string>;
  canonical: Reader;
  views: Reader;
}): Promise<Prepared | undefined> => {
  const { operation } = input;
  if (isOrderedMoveOperation(operation)) return undefined;
  const decided = input.refused
    ? operation
    : { ...operation, edits: operation.edits.filter((edit) => input.skipped.has(edit.recordId)) };
  const targets = await displacedTargets(decided, input.canonical);
  const edits = decided.edits.flatMap((edit): OrderedEdit[] => {
    const target = targets.get(edit.recordId);
    if (!target) return [];
    const changes = unwrappedChanges(edit.changes);
    const texts = (edit.texts ?? []).flatMap((text) =>
      text.path[0] === "value" && text.path[1] === "value"
        ? [{ ...text, path: ["value", ...text.path.slice(2)], dependencies: [] }]
        : [],
    );
    if (!changes.length && !texts.length && edit.deleted !== true) return [];
    return [
      {
        recordId: target.to,
        changes,
        ...(texts.length ? { texts } : {}),
        ...(edit.deleted === true ? { deleted: true } : {}),
        base: target.base,
      },
    ];
  });
  if (!edits.length) return undefined;
  const forwarded = await prepareOrderedOperation(
    { operationId: crypto.randomUUID(), edits },
    await input.views(edits.map((edit) => edit.recordId)),
  );
  return { operation: forwarded, identity: await fingerprint({ forward: forwarded as unknown as Json }) };
};

/**
 * Moves for old collection items that are still live although their collection moved: a refused or
 * skipped page, or an old-format create from a device that had not seen the marker. Every device
 * plans them for the records a sync changed; conditional moves make duplicates converge.
 */
export const planCatchUpMoves = async (input: {
  changed: Iterable<string>;
  canonical: Reader;
  list: (prefix: string) => Promise<string[]>;
}) => {
  const collections = new Map<string, { scopeType: string; scopeId: string; name: string; items: Set<string> }>();
  const whole = new Set<string>();
  const entry = (scopeType: string, scopeId: string, name: string) => {
    const key = collectionMoveMarkerId(scopeType, scopeId, name);
    const found = collections.get(key) ?? { scopeType, scopeId, name, items: new Set<string>() };
    collections.set(key, found);
    return { key, found };
  };
  for (const id of input.changed) {
    const item = collectionItem(id);
    if (item) entry(item.scopeType, item.scopeId, item.name).found.items.add(id);
    const marker = collectionMarker(id);
    if (marker) whole.add(entry(marker.scopeType, marker.scopeId, marker.name).key);
  }
  if (!collections.size) return [];
  const prefixFor = await keyPrefixes(input.canonical, [...collections.values()]);
  const moves: OrderedRecordMove[] = [];
  for (const [key, { scopeType, scopeId, name, items }] of collections) {
    const prefix = prefixFor(scopeType, scopeId, name);
    if (prefix === undefined) continue;
    // A listed projection can predate items created in the same sync, so keep the changed ones too.
    const ids = whole.has(key)
      ? [...new Set([...(await input.list(collectionRecordPrefix(scopeType, scopeId, name))), ...items])]
      : [...items];
    for (const from of ids)
      moves.push({ from, to: storageRecordId([scopeType, scopeId, "kv"], prefix + collectionItem(from)!.itemId) });
  }
  return moves;
};

/** Prepare catch-up moves in bounded groups; an item whose target is taken stays where it is. */
export const prepareCatchUpMoves = async (moves: OrderedRecordMove[], views: Reader) => {
  const prepared: Prepared[] = [];
  let pending = moves;
  while (pending.length) {
    const page = pending.slice(0, 100);
    const result = await prepareOrderedMove(await views(page.flatMap(({ from, to }) => [from, to])), {
      moves: page,
      field: ["value"],
      conflict: "skip",
    });
    if (result.operation) prepared.push({ operation: result.operation, identity: result.identity! });
    pending = [...result.remaining, ...pending.slice(100)];
  }
  return prepared;
};
