import { expect, test } from "bun:test";
import { createSyncSpace, openUpdate, sealUpdate } from "../encryption";
import { applyOrderedOperation, prepareOrderedOperation } from "../records/ordered-operation";
import { decodeOrderedEntry, encodeOrderedEntry, type OrderedStreamEntry } from "./ordered-stream-entry";
import { decodeRecordFrame, encodeRecordFrame } from "./record-frames";

test("ordered records cross the real encrypted frame boundary with their client format and metadata", async () => {
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const operation = await prepareOrderedOperation(
    { operationId: "seed", edits: [{ recordId: "card", replace: { title: "Ship\nlist" } }] },
    new Map(),
  );
  const record = applyOrderedOperation(new Map(), operation, "epoch").records[0]!;
  const entry: OrderedStreamEntry = { type: "record", record };
  const sealed = await sealUpdate(
    space,
    "document",
    encodeRecordFrame({ format: "ordered", records: [encodeOrderedEntry(entry)], assets: [] }),
    [],
  );
  const frame = decodeRecordFrame(await openUpdate(space, "document", sealed));
  expect(frame.format).toBe("ordered");
  expect(await decodeOrderedEntry(frame.records[0]!.bytes)).toEqual(entry);
});

test("a checkpoint cannot omit canonical value or stamps or add an unknown behavior", async () => {
  const original = {
    type: "record",
    record: { recordId: "card", value: true, deleted: false, lifetime: "initial", stamps: {} },
  };
  for (const missing of ["value", "stamps"]) {
    const input = structuredClone(original) as { type: string; record: Record<string, unknown> };
    delete input.record[missing];
    await expect(decodeOrderedEntry(new TextEncoder().encode(JSON.stringify(input)))).rejects.toThrow(
      "Invalid ordered",
    );
  }
  await expect(
    decodeOrderedEntry(new TextEncoder().encode(JSON.stringify({ ...original, inventedRule: true }))),
  ).rejects.toThrow("Invalid ordered");
});
