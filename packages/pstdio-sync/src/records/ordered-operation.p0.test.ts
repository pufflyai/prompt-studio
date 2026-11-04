import { expect, test } from "bun:test";
import type { Json } from "pstdio-sync-contracts";
import {
  applyOrderedOperation,
  type OrderedOperation,
  type OrderedRecord,
  observeOrderedRecord,
  prepareOrderedOperation,
  projectOrderedOperation,
} from "./ordered-operation";

const create = async (value: Json) => {
  const records = new Map<string, OrderedRecord>();
  const operation = await prepareOrderedOperation(
    { operationId: "seed", edits: [{ recordId: "card", replace: value }] },
    records,
  );
  for (const record of applyOrderedOperation(records, operation, "epoch").records) records.set(record.recordId, record);
  return records;
};
const apply = (records: Map<string, OrderedRecord>, operation: OrderedOperation) => {
  const result = applyOrderedOperation(records, operation, "epoch");
  for (const record of result.records) records.set(record.recordId, record);
  return result;
};

test("serialized offline operations keep different fields and later whole multiline strings and arrays", async () => {
  const records = await create({ title: "Seed\ntitle", column: "todo", labels: ["seed"] });
  const observedRevision = await observeOrderedRecord(records.get("card"));
  const moved = await prepareOrderedOperation(
    {
      operationId: "move",
      edits: [
        { recordId: "card", observedRevision, replace: { title: "Seed\ntitle", column: "doing", labels: ["seed"] } },
      ],
    },
    records,
  );
  const renamed = await prepareOrderedOperation(
    {
      operationId: "rename",
      edits: [
        { recordId: "card", observedRevision, replace: { title: "Ship\nlist", column: "todo", labels: ["desktop"] } },
      ],
    },
    records,
  );
  apply(records, JSON.parse(JSON.stringify(moved)));
  apply(records, JSON.parse(JSON.stringify(renamed)));
  expect(records.get("card")!.value).toEqual({ title: "Ship\nlist", column: "doing", labels: ["desktop"] });
});

for (const aba of [false, true])
  test(`an ordered condition refuses every edit after an overlapping change${aba ? " and ABA" : ""}`, async () => {
    const records = await create({ model: "small", theme: "light" });
    const expectedRevision = await observeOrderedRecord(records.get("card"));
    const careful = await prepareOrderedOperation(
      {
        operationId: "careful",
        edits: [
          { recordId: "card", expectedRevision, replace: { model: "careful", theme: "light" } },
          { recordId: "audit", replace: "side effect" },
        ],
      },
      records,
    );
    apply(
      records,
      await prepareOrderedOperation(
        { operationId: "earlier", edits: [{ recordId: "card", replace: { model: "large", theme: "light" } }] },
        records,
      ),
    );
    if (aba)
      apply(
        records,
        await prepareOrderedOperation(
          { operationId: "back", edits: [{ recordId: "card", replace: { model: "small", theme: "light" } }] },
          records,
        ),
      );
    const result = apply(records, careful);
    expect(result.decision.state).toBe("refused");
    expect(result.records).toEqual([]);
    expect(records.has("audit")).toBe(false);
    expect(records.get("card")!.value).toEqual({ model: aba ? "small" : "large", theme: "light" });
    expect(applyOrderedOperation(new Map(), careful, "epoch", result.decision)).toEqual({
      decision: result.decision,
      records: [],
    });
  });

test("a sibling write admits a careful save and a decided operation never applies twice", async () => {
  const records = await create({ model: "small", theme: "light" });
  const expectedRevision = await observeOrderedRecord(records.get("card"));
  const careful = await prepareOrderedOperation(
    {
      operationId: "careful",
      edits: [{ recordId: "card", expectedRevision, replace: { model: "careful", theme: "light" } }],
    },
    records,
  );
  apply(
    records,
    await prepareOrderedOperation(
      { operationId: "theme", edits: [{ recordId: "card", replace: { model: "small", theme: "dark" } }] },
      records,
    ),
  );
  const result = apply(records, careful);
  expect(result.decision.state).toBe("accepted");
  expect(records.get("card")!.value).toEqual({ model: "careful", theme: "dark" });
  expect(applyOrderedOperation(records, careful, "epoch", result.decision).records).toEqual([]);
  expect(() =>
    applyOrderedOperation(records, { ...careful, fingerprint: "different" }, "epoch", result.decision),
  ).toThrow("identity");
  expect(() => applyOrderedOperation(records, careful, "other epoch", result.decision)).toThrow("epoch");
});

test("a stale ordinary save cannot resurrect a tombstone and a condition detects recreation", async () => {
  const records = await create({ title: "seed" });
  const expectedRevision = await observeOrderedRecord(records.get("card"));
  const stale = await prepareOrderedOperation(
    { operationId: "stale", edits: [{ recordId: "card", replace: { title: "offline" } }] },
    records,
  );
  const careful = await prepareOrderedOperation(
    { operationId: "careful", edits: [{ recordId: "card", expectedRevision, replace: { title: "conditional" } }] },
    records,
  );
  apply(
    records,
    await prepareOrderedOperation({ operationId: "delete", edits: [{ recordId: "card", deleted: true }] }, records),
  );
  apply(records, stale);
  expect(records.get("card")!.deleted).toBe(true);
  apply(
    records,
    await prepareOrderedOperation(
      { operationId: "recreate", edits: [{ recordId: "card", deleted: false, replace: { title: "seed" } }] },
      records,
    ),
  );
  expect(apply(records, careful).decision.state).toBe("refused");
  expect(records.get("card")!.value).toEqual({ title: "seed" });
});

test("explicitly keeping a live record admits a careful save after a sibling change", async () => {
  const records = await create({ model: "small", theme: "light" });
  const expectedRevision = await observeOrderedRecord(records.get("card"));
  const careful = await prepareOrderedOperation(
    {
      operationId: "careful",
      edits: [{ recordId: "card", expectedRevision, deleted: false, replace: { model: "careful", theme: "light" } }],
    },
    records,
  );
  apply(
    records,
    await prepareOrderedOperation(
      { operationId: "theme", edits: [{ recordId: "card", replace: { model: "small", theme: "dark" } }] },
      records,
    ),
  );
  expect(apply(records, careful).decision.state).toBe("accepted");
  expect(records.get("card")!.value).toEqual({ model: "careful", theme: "dark" });
});

test("deleting and restoring without a replacement retains the saved value", async () => {
  const records = await create({ title: "saved" });
  apply(
    records,
    await prepareOrderedOperation({ operationId: "delete", edits: [{ recordId: "card", deleted: true }] }, records),
  );
  apply(
    records,
    await prepareOrderedOperation({ operationId: "restore", edits: [{ recordId: "card", deleted: false }] }, records),
  );
  expect(records.get("card")!.value).toEqual({ title: "saved" });
  expect(records.get("card")!.deleted).toBe(false);
});

test("an edit without a value or lifecycle action cannot create an empty record", async () => {
  await expect(
    prepareOrderedOperation({ operationId: "empty", edits: [{ recordId: "card" }] }, new Map()),
  ).rejects.toThrow("Empty record edit");
});

test("readmitting an immutable operation after relay loss cannot alias an older canonical observation", async () => {
  const records = await create({ model: "seed" });
  const first = await prepareOrderedOperation(
    { operationId: "A", edits: [{ recordId: "card", replace: { model: "A" } }] },
    records,
  );
  apply(records, first);
  const expectedRevision = await observeOrderedRecord(records.get("card"));
  const careful = await prepareOrderedOperation(
    { operationId: "careful", edits: [{ recordId: "card", expectedRevision, replace: { model: "careful" } }] },
    records,
  );
  apply(
    records,
    await prepareOrderedOperation(
      { operationId: "B", edits: [{ recordId: "card", replace: { model: "B" } }] },
      records,
    ),
  );
  for (const record of applyOrderedOperation(records, first, "new epoch").records) records.set(record.recordId, record);
  expect(applyOrderedOperation(records, careful, "new epoch").decision.state).toBe("refused");
});

test("a condition authored over pending work resolves its receipt without rewriting the envelope", async () => {
  const canonical = new Map<string, OrderedRecord>();
  const seed = await prepareOrderedOperation(
    { operationId: "seed", edits: [{ recordId: "card", replace: { model: "seed" } }] },
    canonical,
  );
  const optimistic = new Map(projectOrderedOperation(canonical, seed).map((record) => [record.recordId, record]));
  const expectedRevision = await observeOrderedRecord(optimistic.get("card"));
  const careful = await prepareOrderedOperation(
    { operationId: "careful", edits: [{ recordId: "card", expectedRevision, replace: { model: "careful" } }] },
    optimistic,
  );
  const immutable = JSON.stringify(careful);
  expect(projectOrderedOperation(optimistic, careful)[0]!.value).toEqual({ model: "careful" });
  const accepted = applyOrderedOperation(canonical, seed, "first epoch");
  for (const record of accepted.records) canonical.set(record.recordId, record);
  expect(() => applyOrderedOperation(canonical, careful, "first epoch")).toThrow("exact receipt");
  const dependencies = new Map([["seed", accepted.decision]]);
  expect(applyOrderedOperation(canonical, careful, "first epoch", undefined, dependencies).decision.state).toBe(
    "accepted",
  );
  expect(
    applyOrderedOperation(
      canonical,
      careful,
      "first epoch",
      undefined,
      new Map([["seed", { ...accepted.decision, state: "refused" }]]),
    ).decision.state,
  ).toBe("refused");
  expect(JSON.stringify(careful)).toBe(immutable);
});

test("exact refusal receipts override a restored pending view and dependency receipts bind identity", async () => {
  const canonical = new Map<string, OrderedRecord>();
  const seed = await prepareOrderedOperation(
    { operationId: "seed", edits: [{ recordId: "card", replace: "seed" }] },
    canonical,
  );
  const restored = new Map(projectOrderedOperation(canonical, seed).map((record) => [record.recordId, record]));
  const expectedRevision = await observeOrderedRecord(restored.get("card"));
  const child = await prepareOrderedOperation(
    { operationId: "child", edits: [{ recordId: "card", expectedRevision, replace: "child" }] },
    restored,
  );
  const accepted = applyOrderedOperation(canonical, seed, "epoch");
  for (const record of accepted.records) canonical.set(record.recordId, record);
  const refused = new Map([["seed", { ...accepted.decision, state: "refused" as const }]]);
  expect(projectOrderedOperation(restored, child, refused)).toEqual([]);
  for (const invalid of [
    { ...accepted.decision, operationId: "other" },
    { ...accepted.decision, fingerprint: "wrong" },
  ]) {
    expect(() => applyOrderedOperation(canonical, child, "epoch", undefined, new Map([["seed", invalid]]))).toThrow(
      "identity",
    );
  }
});
