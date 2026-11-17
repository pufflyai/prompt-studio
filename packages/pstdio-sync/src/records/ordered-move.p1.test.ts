import { expect, test } from "bun:test";
import { collectionMoveMarkerId, storageRecordId } from "./namespaces";
import { OrderedMoveGuardError, prepareOrderedMove } from "./ordered-move";
import type { OrderedRecord } from "./ordered-operation";

const record = (recordId: string, value: unknown): OrderedRecord => ({
  recordId,
  value: { value } as never,
  deleted: false,
  lifetime: "initial",
  stamps: {},
});
const marker = collectionMoveMarkerId("project", "p", "tickets");
const from = storageRecordId(["project", "p", "collection", "tickets"], "a");
const to = storageRecordId(["project", "p", "kv"], "ticket:a");
const input = {
  moves: [{ from, to }],
  field: ["value"],
  guard: { recordId: marker, path: ["value", "keyPrefix"], value: "ticket:" },
};

test("a group refuses to move under a marker that another device changed after the first read", async () => {
  const views = new Map([
    [from, record(from, { value: { title: "A" }, sortOrder: null })],
    [marker, record(marker, { keyPrefix: "item:" })],
  ]);
  await expect(prepareOrderedMove(views, input)).rejects.toBeInstanceOf(OrderedMoveGuardError);
});

test("a group under the marker it expects rewrites that marker on the condition that it is unchanged", async () => {
  const views = new Map([
    [from, record(from, { value: { title: "A" }, sortOrder: null })],
    [marker, record(marker, { keyPrefix: "ticket:" })],
  ]);
  const { operation } = await prepareOrderedMove(views, input);
  const guard = operation!.edits.find((edit) => edit.recordId === marker)!;
  expect(guard.changes).toEqual([{ path: ["value", "keyPrefix"], set: "ticket:" }]);
  expect(guard.condition).toBeDefined();
});
