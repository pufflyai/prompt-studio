import type { StorageRecord } from "pstdio-sync-contracts";
import { collectionMoveMarkerId, collectionRecordPrefix, recordKeyPrefix, storageRecordId } from "./namespaces";
import { OrderedMoveTargetExistsError, type OrderedRecordMove } from "./ordered-move";
import type { OrderedEdit } from "./ordered-operation";

const PAGE = 100;

export interface MovableRecords {
  read(id: string): Promise<StorageRecord>;
  list(prefix: string): Promise<StorageRecord[]>;
  move(input: {
    moves: OrderedRecordMove[];
    field: string[];
    extra?: OrderedEdit[];
    conflict?: "throw" | "skip";
    guard?: { recordId: string; path: string[]; value: string };
  }): Promise<{ moved: number; remaining: OrderedRecordMove[] }>;
}

/**
 * Move every live item of a deprecated collection to `records.id(keyPrefix + itemId)` in the same
 * scope. The marker saved with the first group tells every device's collection API where items live.
 */
export const moveCollection = async (
  records: MovableRecords,
  /** `pageSize` bounds the items per group; it defaults to 100 and exists for tests. */
  input: { scopeType: string; scopeId: string; name: string; keyPrefix: string; pageSize?: number },
) => {
  // A delimiter keeps the prefix from matching other keys, such as "tickets-config" for "ticket".
  if (!/[^A-Za-z0-9]$/.test(input.keyPrefix))
    throw new Error('A collection key prefix must end with a delimiter such as ":"');
  const markerId = collectionMoveMarkerId(input.scopeType, input.scopeId, input.name);
  const marker = await records.read(markerId);
  const saved = marker.exists && !marker.deleted ? (marker.value as { keyPrefix?: unknown }).keyPrefix : undefined;
  if (saved !== undefined && saved !== input.keyPrefix)
    throw new Error(`Collection ${input.name} already moved to key prefix ${String(saved)}`);
  const items = await records.list(collectionRecordPrefix(input.scopeType, input.scopeId, input.name));
  const target = (item: StorageRecord) =>
    storageRecordId(
      [input.scopeType, input.scopeId, "kv"],
      input.keyPrefix + (JSON.parse(item.recordId) as string[]).at(-1)!,
    );
  let moves: OrderedRecordMove[] = items.map((item) => ({ from: item.recordId, to: target(item) }));
  // Check every target before the first page, so a taken address cannot leave the collection half moved.
  const taken = new Set(
    (await records.list(recordKeyPrefix(input.scopeType, input.scopeId, input.keyPrefix))).map(
      (record) => record.recordId,
    ),
  );
  const collision = moves.find((move) => taken.has(move.to));
  if (collision) throw new OrderedMoveTargetExistsError(collision.from, collision.to);
  // The marker is its own save, written before any item. It applies without a base, so it is never
  // skipped, but only while no other device has saved a marker, so two prefixes cannot both win. A
  // restored recovery point can leave it as a tombstone; saving it again revives it.
  if (saved === undefined)
    await records.move({
      moves: [],
      field: ["value"],
      extra: [
        {
          recordId: markerId,
          changes: [{ path: [], set: { value: { keyPrefix: input.keyPrefix } } }],
          ...(marker.exists && marker.deleted ? { deleted: false } : {}),
          base: null,
          expectedRevision: marker.revision,
        },
      ],
    });
  let moved = 0;
  while (moves.length) {
    // A group reads its records under the owner lock; bounded pages keep each lock short.
    // Each group also requires the marker it saw, so a group under a losing marker is refused and
    // catch-up moves its items under the winning prefix.
    const result = await records.move({
      moves: moves.slice(0, input.pageSize ?? PAGE),
      field: ["value"],
      guard: { recordId: markerId, path: ["value", "keyPrefix"], value: input.keyPrefix },
    });
    moved += result.moved;
    moves = [...result.remaining, ...moves.slice(input.pageSize ?? PAGE)];
  }
  return { moved };
};
