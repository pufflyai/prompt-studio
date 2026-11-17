import { expect, test } from "bun:test";
import { collectionMoveMarkerId, storageRecordId } from "./namespaces";
import { planCatchUpMoves } from "./ordered-move-forward";
import type { OrderedRecord } from "./ordered-operation";

const record = (recordId: string, value: unknown, deleted = false): OrderedRecord => ({
  recordId,
  value: { value } as never,
  deleted,
  lifetime: "initial",
  stamps: {},
});

test("a whole-collection catch-up keeps items created in the same sync that the listing missed", async () => {
  const marker = collectionMoveMarkerId("project", "p", "tickets");
  const item = (id: string) => storageRecordId(["project", "p", "collection", "tickets"], id);
  const canonical = new Map([[marker, record(marker, { keyPrefix: "ticket:" })]]);
  const moves = await planCatchUpMoves({
    changed: [marker, item("new")],
    canonical: async (ids) => new Map(ids.flatMap((id) => (canonical.has(id) ? [[id, canonical.get(id)!]] : []))),
    // The projection was listed before this sync's new item reached it.
    list: async () => [item("old")],
  });
  expect(moves.map((move) => move.from).sort()).toEqual([item("new"), item("old")].sort());
  expect(moves.find((move) => move.from === item("new"))?.to).toBe(
    storageRecordId(["project", "p", "kv"], "ticket:new"),
  );
});
