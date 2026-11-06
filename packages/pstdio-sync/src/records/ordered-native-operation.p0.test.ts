import { expect, test } from "bun:test";
import { fingerprint } from "pstdio-sync-contracts";
import { jsonPointer } from "./ordered-json";
import {
  applyOrderedNativeOperation,
  projectOrderedNativeOperation,
  validateOrderedNativeOperation,
} from "./ordered-native-operation";
import {
  applyOrderedOperation,
  type OrderedRecord,
  observeOrderedRecord,
  prepareOrderedOperation,
} from "./ordered-operation";
import { prepareOrderedText } from "./ordered-text";

const path = ["value", "body"];
const key = jsonPointer(path);
const fixture = async () => {
  const initial = {
    recordId: "card",
    value: { value: { body: "hello" } },
    deleted: false,
    lifetime: "initial",
    stamps: {},
  } satisfies OrderedRecord;
  const text = await prepareOrderedText({
    recordId: initial.recordId,
    lifetime: initial.lifetime,
    path,
    value: initial.value,
    replace: "hello",
  });
  const seed = await prepareOrderedOperation(
    { operationId: "seed", edits: [{ recordId: "card", changes: [], texts: [text] }] },
    new Map([["card", initial]]),
  );
  const record = applyOrderedOperation(new Map([["card", initial]]), seed, "order").records[0]!;
  return new Map([[record.recordId, record]]);
};
const native = async (records: ReadonlyMap<string, OrderedRecord>, id: string, text: string) => {
  const record = records.get("card")!;
  const change = await prepareOrderedText({
    recordId: "card",
    lifetime: record.lifetime,
    path,
    value: record.value,
    saved: record.texts![key],
    replace: text,
  });
  return prepareOrderedOperation(
    { operationId: id, edits: [{ recordId: "card", changes: [], texts: [change] }] },
    records,
  );
};

test("native text observations agree before and after ordering without a frame receipt or pending frame identity", async () => {
  const records = await fixture();
  const operation = await native(records, "typing", "hello world");
  const optimistic = await projectOrderedNativeOperation(records, operation);
  const canonical = await applyOrderedNativeOperation(records, operation, "order");
  expect(canonical.state).toBe("accepted");
  expect(optimistic[0]!.stamps).toEqual(canonical.records[0]!.stamps);
  expect(optimistic[0]!.texts![key]!.pending).toEqual([]);
  expect(JSON.parse(optimistic[0]!.stamps[key]!)).toEqual([
    "text",
    optimistic[0]!.texts![key]!.seed,
    await fingerprint(optimistic[0]!.texts![key]!.state),
  ]);
});

test("duplicate native deltas never regress a later public group's stamp", async () => {
  const records = await fixture();
  const operation = await native(records, "typing", "first");
  for (const record of (await applyOrderedNativeOperation(records, operation, "order")).records)
    records.set(record.recordId, record);
  const later = await native(records, "public-save", "later");
  for (const record of applyOrderedOperation(records, later, "order").records) records.set(record.recordId, record);
  const before = records.get("card")!;
  expect((await applyOrderedNativeOperation(records, operation, "order")).records).toEqual([]);
  expect(await projectOrderedNativeOperation(records, operation)).toEqual([]);
  expect(records.get("card")).toBe(before);
});

test("a native delta carrying a refused group's structs is refused without leaking its text", async () => {
  const records = await fixture();
  const group = await native(records, "group", "private group");
  const { projectOrderedOperation } = await import("./ordered-operation");
  const optimistic = new Map(records);
  for (const record of projectOrderedOperation(optimistic, group)) optimistic.set(record.recordId, record);
  const operation = await native(optimistic, "typing", "private group plus typing");
  expect(await projectOrderedNativeOperation(records, operation)).toEqual([]);
  const refused = new Map([
    [
      group.operationId,
      { operationId: group.operationId, epoch: "order", fingerprint: group.fingerprint, state: "refused" as const },
    ],
  ]);
  const result = await applyOrderedNativeOperation(records, operation, "order", refused);
  expect(result.state).toBe("refused");
  expect(result.records).toEqual([]);
  expect(await projectOrderedNativeOperation(optimistic, operation, refused)).toEqual([]);
});

test("native frames cannot write plain fields, conditions, lifecycles or missing records", async () => {
  const records = await fixture();
  const operation = await native(records, "typing", "updated");
  validateOrderedNativeOperation(operation);
  expect(() => validateOrderedNativeOperation({ ...operation, edits: [] })).toThrow();
  for (const extra of [
    { changes: [{ path: ["value", "title"], set: "forbidden" }] },
    { deleted: false },
    { condition: JSON.parse(await observeOrderedRecord(records.get("card"))) },
  ]) {
    const invalid = { ...operation, edits: operation.edits.map((edit) => ({ ...edit, ...extra })) };
    expect(() => validateOrderedNativeOperation(invalid)).toThrow();
  }
  expect((await applyOrderedNativeOperation(new Map(), operation, "order")).state).toBe("refused");
});

test("conditional native-text observations detect character-history ABA without a frame receipt", async () => {
  const records = await fixture();
  for (const record of (await applyOrderedNativeOperation(records, await native(records, "first", "edited"), "order"))
    .records)
    records.set(record.recordId, record);
  const observed = await observeOrderedRecord(records.get("card"));
  for (const [id, value] of [
    ["away", "another value"],
    ["back", "edited"],
  ])
    for (const record of (await applyOrderedNativeOperation(records, await native(records, id!, value!), "order"))
      .records)
      records.set(record.recordId, record);
  const changes = (await native(records, "careful", "careful")).edits[0]!.texts!;
  const group = await prepareOrderedOperation(
    { operationId: "careful", edits: [{ recordId: "card", changes: [], texts: changes, expectedRevision: observed }] },
    records,
  );
  expect(applyOrderedOperation(records, group, "order").decision.state).toBe("refused");
});
