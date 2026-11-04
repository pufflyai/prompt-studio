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

test("ordered checkpoint metadata carries one explicit bounded receipt root", async () => {
  const empty = { type: "meta" as const, epoch: "order", receiptRoot: null };
  expect(await decodeOrderedEntry(encodeOrderedEntry(empty).bytes)).toEqual(empty);
  const root = { blobId: "A".repeat(24), byteLength: 123 };
  const rooted = { ...empty, receiptRoot: root };
  expect(await decodeOrderedEntry(encodeOrderedEntry(rooted).bytes)).toEqual(rooted);
  for (const receiptRoot of [undefined, { ...root, byteLength: -1 }, { ...root, hiddenHistory: [] }])
    await expect(
      decodeOrderedEntry(new TextEncoder().encode(JSON.stringify({ type: "meta", epoch: "order", receiptRoot }))),
    ).rejects.toThrow();
  await expect(
    decodeOrderedEntry(new TextEncoder().encode(JSON.stringify({ type: "meta", epoch: "order", receipts: [] }))),
  ).rejects.toThrow();
});

test("native text frame decoding rejects a valid public operation that writes plain fields", async () => {
  const operation = await prepareOrderedOperation(
    { operationId: "plain", edits: [{ recordId: "card", replace: { title: "forbidden" } }] },
    new Map(),
  );
  const entry: OrderedStreamEntry = { type: "text", admission: { operation, epoch: "order", dependencies: [] } };
  await expect(decodeOrderedEntry(encodeOrderedEntry(entry).bytes)).rejects.toThrow("native text frame");
});
