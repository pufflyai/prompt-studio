import { canonicalJson, fingerprint, type Json } from "pstdio-sync-contracts";
import { jsonPointer, parseJsonPointer } from "./ordered-json";
import {
  type OrderedEdit,
  type OrderedOperation,
  type OrderedRecord,
  observeOrderedRecord,
  prepareOrderedOperation,
} from "./ordered-operation";
import { orderedBody } from "./ordered-projection";
import { type OrderedTextChange, readOrderedPath } from "./ordered-text";

export interface OrderedRecordMove {
  from: string;
  to: string;
}

export class OrderedMoveTargetExistsError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Cannot move ${from}: ${to} already exists`);
  }
}

/** Below the 4 MiB group limit, leaving room for the encoding of carried text states. */
const MOVE_GROUP_BYTES = 2 * 1024 * 1024;

/** Host collection moves are recognizable in relay order, so a displaced write can tell a move from an edit. */
export const orderedMoveOperationId = () => `move:${crypto.randomUUID()}`;
export const isOrderedMoveOperation = (operation: Pick<OrderedOperation, "operationId">) =>
  operation.operationId.startsWith("move:");

export class OrderedMoveGuardError extends Error {
  constructor(
    readonly recordId: string,
    readonly found: unknown,
  ) {
    super(`Cannot move: ${recordId} now holds ${JSON.stringify(found ?? null)}`);
  }
}

const startsWith = (path: string[], prefix: string[]) => prefix.every((key, index) => path[index] === key);

/**
 * The new record keeps the old record's text history and native-source keys, so open editors
 * follow it. `field` names the part of the old value that becomes the new value.
 */
const movedEdits = async (record: OrderedRecord, target: OrderedRecord | undefined, to: string, field: string[]) => {
  const body = orderedBody(record);
  const from = ["value", ...field];
  const texts: OrderedTextChange[] = Object.entries(record.texts ?? {}).flatMap(([pointer, text]) => {
    const path = parseJsonPointer(pointer);
    if (!startsWith(path, from)) return [];
    return [{ path: ["value", ...path.slice(from.length)], update: text.state, seed: text.seed, dependencies: [] }];
  });
  const prefix = jsonPointer(field);
  const sources = Object.entries(body.nativeSources).map(([key, source]) => {
    if (!("field" in source) || !source.field.startsWith(`${prefix}/`)) return [key, source] as const;
    return [key, { ...source, field: source.field.slice(prefix.length) }] as const;
  });
  // The whole body is one change at the root, which also starts a revived tombstone from empty.
  const created: OrderedEdit = {
    recordId: to,
    changes: [
      {
        path: [],
        set: {
          value: (readOrderedPath(record.value, from) ?? null) as Json,
          nativeSources: Object.fromEntries(sources) as unknown as Json,
          ...(body.asset ? { asset: body.asset as unknown as Json } : {}),
        },
      },
    ],
    ...(texts.length ? { texts } : {}),
    // A tombstone at the target (a restored recovery point) is revived; a live record is a collision.
    ...(target ? { deleted: false } : {}),
    expectedRevision: await observeOrderedRecord(target),
  };
  const removed: OrderedEdit = {
    recordId: record.recordId,
    deleted: true,
    expectedRevision: await observeOrderedRecord(record),
  };
  return [created, removed];
};

// Another device's marker can arrive between the caller's first read and a group, so check it here.
const guardEdit = async (
  views: ReadonlyMap<string, OrderedRecord>,
  guard: NonNullable<OrderedMoveInput["guard"]>,
): Promise<OrderedEdit> => {
  const record = views.get(guard.recordId);
  const current = record && !record.deleted ? readOrderedPath(record.value, guard.path) : undefined;
  if (canonicalJson(current ?? null) !== canonicalJson(guard.value))
    throw new OrderedMoveGuardError(guard.recordId, current);
  return {
    recordId: guard.recordId,
    changes: [{ path: guard.path, set: guard.value }],
    expectedRevision: await observeOrderedRecord(record),
  };
};

export interface OrderedMoveInput {
  moves: OrderedRecordMove[];
  /** The part of each old value that becomes the new record's value. */
  field: string[];
  /** Host edits saved in the same group, such as a marker. */
  extra?: OrderedEdit[];
  /** A catch-up move during sync leaves an item whose target is taken where it is instead of failing. */
  conflict?: "throw" | "skip";
  /**
   * A live record whose value at `path` must already equal `value`, such as the collection marker's
   * key prefix. The group rewrites it on the condition that it is unchanged since `views`, so relay
   * order refuses the group if another device changes it later.
   */
  guard?: { recordId: string; path: string[]; value: Json };
}

/**
 * Prepare one ordered save that moves live records to new IDs. Each old record is deleted on the
 * condition that it is unchanged since `views`, so relay order refuses a move that missed a
 * concurrent edit. Records already gone are skipped, which makes a retried move safe. Moves past
 * the group budget come back in `remaining` for the next save.
 */
export const prepareOrderedMove = async (views: ReadonlyMap<string, OrderedRecord>, input: OrderedMoveInput) => {
  const edits: OrderedEdit[] = [...(input.extra ?? [])];
  let moved = 0;
  let bytes = 0;
  let next = 0;
  // Carried text history counts toward the group limit; the caller saves the rest in later groups.
  for (; next < input.moves.length; next++) {
    const { from, to } = input.moves[next]!;
    const record = views.get(from);
    if (!record || record.deleted) continue;
    const target = views.get(to);
    if (target && !target.deleted) {
      if (input.conflict === "skip") continue;
      throw new OrderedMoveTargetExistsError(from, to);
    }
    const pair = await movedEdits(record, target, to, input.field);
    const size = JSON.stringify(pair).length;
    if (moved && bytes + size > MOVE_GROUP_BYTES) break;
    edits.push(...pair);
    bytes += size;
    moved++;
  }
  const remaining = input.moves.slice(next);
  if (moved && input.guard) edits.push(await guardEdit(views, input.guard));
  if (!edits.length) return { moved, remaining, operation: undefined, identity: undefined };
  // Two devices can run the same move; each save needs its own identity in relay order.
  const operation = await prepareOrderedOperation({ operationId: orderedMoveOperationId(), edits }, views);
  return { moved, remaining, operation, identity: await fingerprint({ move: operation as unknown as Json }) };
};
