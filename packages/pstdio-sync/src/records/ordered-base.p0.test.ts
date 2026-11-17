import { expect, test } from "bun:test";
import type { Json } from "pstdio-sync-contracts";
import { operationDependencies } from "./ordered-dependencies";
import {
  applyOrderedOperation,
  type OrderedOperation,
  type OrderedRecord,
  prepareOrderedOperation,
  projectOrderedOperation,
} from "./ordered-operation";
import { verifyOrderedOperation } from "./ordered-operation-wire";

type Records = Map<string, OrderedRecord>;

const seeded = async (value: Json) => {
  const records: Records = new Map();
  const seed = await prepareOrderedOperation(
    { operationId: "seed", edits: [{ recordId: "PS-1", replace: value }] },
    records,
  );
  for (const record of applyOrderedOperation(records, seed, "epoch").records) records.set(record.recordId, record);
  return records;
};
const apply = (records: Records, operation: OrderedOperation, dependencies = new Map()) => {
  const result = applyOrderedOperation(records, operation, "epoch", undefined, dependencies);
  for (const record of result.records) records.set(record.recordId, record);
  return result;
};
const save = (records: Records, operationId: string, edit: Parameters<typeof prepareOrderedOperation>[0]["edits"][0]) =>
  prepareOrderedOperation({ operationId, edits: [edit] }, records);
const value = (records: Records) => records.get("PS-1")!.value;

test("a returning save keeps fields nobody else changed and loses fields the in-sync devices changed", async () => {
  const records = await seeded({ title: "Seed", assignee: "Ann", status: "Todo" });
  // Laptop saves from the seed while away.
  const laptop = await save(records, "laptop", {
    recordId: "PS-1",
    replace: { title: "Laptop title", assignee: "Cara", status: "Todo" },
  });
  // Desktop stays in sync and reaches Cloud first.
  apply(
    records,
    await save(records, "desktop", { recordId: "PS-1", replace: { title: "Seed", assignee: "Dev", status: "Done" } }),
  );
  const result = apply(records, JSON.parse(JSON.stringify(laptop)));
  expect(result.decision.state).toBe("accepted");
  expect(value(records)).toEqual({ title: "Laptop title", assignee: "Dev", status: "Done" });
  expect(result.skipped).toEqual([{ recordId: "PS-1", paths: ["/assignee"], whole: false }]);
});

test("a deletion from a device that was away leaves a record the in-sync devices edited", async () => {
  const records = await seeded({ title: "Seed", status: "Todo" });
  const laptop = await save(records, "laptop", { recordId: "PS-1", deleted: true });
  apply(records, await save(records, "desktop", { recordId: "PS-1", replace: { title: "Seed", status: "Done" } }));
  const result = apply(records, laptop);
  expect(records.get("PS-1")!.deleted).toBe(false);
  expect(value(records)).toEqual({ title: "Seed", status: "Done" });
  expect(result.skipped).toEqual([{ recordId: "PS-1", paths: [], whole: true }]);
});

test("an edit from a device that was away does not revive a record the in-sync devices deleted", async () => {
  const records = await seeded({ title: "Seed" });
  const laptop = await save(records, "laptop", { recordId: "PS-1", replace: { title: "Renamed" } });
  apply(records, await save(records, "desktop", { recordId: "PS-1", deleted: true }));
  const result = apply(records, laptop);
  expect(records.get("PS-1")!.deleted).toBe(true);
  expect(result.skipped).toEqual([{ recordId: "PS-1", paths: ["/title"], whole: true }]);
});

test("a deletion applies when nobody changed the record after its base", async () => {
  const records = await seeded({ title: "Seed" });
  const laptop = await save(records, "laptop", { recordId: "PS-1", deleted: true });
  expect(apply(records, laptop).skipped).toEqual([]);
  expect(records.get("PS-1")!.deleted).toBe(true);
});

test("a restore loses to a record another device recreated or edited after the base", async () => {
  const records = await seeded({ title: "Seed" });
  apply(records, await save(records, "deleted", { recordId: "PS-1", deleted: true }));
  const laptop = await save(records, "laptop", { recordId: "PS-1", deleted: false, replace: { title: "Laptop" } });
  apply(records, await save(records, "desktop", { recordId: "PS-1", deleted: false, replace: { title: "Desktop" } }));
  expect(apply(records, laptop).skipped[0]!.whole).toBe(true);
  expect(value(records)).toEqual({ title: "Desktop" });
});

test("successive own saves resolve their pending base through exact receipts", async () => {
  const canonical = await seeded({ title: "Seed" });
  const first = await save(canonical, "first", { recordId: "PS-1", replace: { title: "One" } });
  const optimistic: Records = new Map([
    ...canonical,
    ...projectOrderedOperation(canonical, first).map((r) => [r.recordId, r] as const),
  ]);
  const second = await save(optimistic, "second", { recordId: "PS-1", replace: { title: "Two" } });
  expect([...operationDependencies(second).keys()]).toEqual(["first"]);
  const accepted = apply(canonical, first);
  expect(() => applyOrderedOperation(canonical, second, "epoch")).toThrow("exact receipt");
  const result = apply(canonical, second, new Map([["first", accepted.decision]]));
  expect(result.skipped).toEqual([]);
  expect(value(canonical)).toEqual({ title: "Two" });
});

test("own saves after an in-sync change to the same field are all replaced, also optimistically", async () => {
  const canonical = await seeded({ assignee: "Ann" });
  const first = await save(canonical, "first", { recordId: "PS-1", replace: { assignee: "Cara" } });
  const optimistic: Records = new Map(projectOrderedOperation(canonical, first).map((r) => [r.recordId, r]));
  const second = await save(optimistic, "second", { recordId: "PS-1", replace: { assignee: "Cara B" } });
  apply(canonical, await save(canonical, "desktop", { recordId: "PS-1", replace: { assignee: "Dev" } }));
  // The returning device already shows the in-sync value before its saves reach Cloud.
  expect(projectOrderedOperation(canonical, first)).toEqual([]);
  const accepted = apply(canonical, first);
  expect(accepted.skipped[0]!.paths).toEqual(["/assignee"]);
  expect(apply(canonical, second, new Map([["first", accepted.decision]])).skipped[0]!.paths).toEqual(["/assignee"]);
  expect(value(canonical)).toEqual({ assignee: "Dev" });
});

test("a base over a refused save is no longer current", async () => {
  const canonical = await seeded({ title: "Seed" });
  const first = await save(canonical, "first", { recordId: "PS-1", replace: { title: "One" } });
  const optimistic: Records = new Map(projectOrderedOperation(canonical, first).map((r) => [r.recordId, r]));
  const second = await save(optimistic, "second", { recordId: "PS-1", replace: { title: "Two" } });
  const refused = { epoch: "epoch", operationId: "first", fingerprint: first.fingerprint, state: "refused" as const };
  expect(apply(canonical, second, new Map([["first", refused]])).skipped[0]!.paths).toEqual(["/title"]);
  expect(value(canonical)).toEqual({ title: "Seed" });
});

test("a save without a base keeps relay order and a base is part of the verified identity", async () => {
  const records = await seeded({ title: "Seed" });
  const legacy = await prepareOrderedOperation(
    { operationId: "legacy", edits: [{ recordId: "PS-1", replace: { title: "Legacy" }, base: null }] },
    records,
  );
  expect(legacy.edits[0]!.base).toBeUndefined();
  apply(records, await save(records, "desktop", { recordId: "PS-1", replace: { title: "Desktop" } }));
  expect(apply(records, legacy).skipped).toEqual([]);
  expect(value(records)).toEqual({ title: "Legacy" });

  const based = await save(records, "based", { recordId: "PS-1", replace: { title: "Based" } });
  expect(await verifyOrderedOperation(JSON.parse(JSON.stringify(based)))).toEqual(based);
  const tampered = structuredClone(based);
  tampered.edits[0]!.base!.stamps = {};
  await expect(verifyOrderedOperation(tampered)).rejects.toThrow("identity");
});

test("new records and fields created on both devices keep the first write per field", async () => {
  const records: Records = new Map();
  const laptop = await save(records, "laptop", { recordId: "PS-4", replace: { title: "Laptop" } });
  apply(records, await save(records, "desktop", { recordId: "PS-4", replace: { title: "Desktop", status: "Todo" } }));
  apply(records, laptop);
  expect(records.get("PS-4")!.value).toEqual({ title: "Desktop", status: "Todo" });
});

test("a folded save that supersedes a save already in Cloud keeps its later value", async () => {
  const records = await seeded({ title: "Seed" });
  // The first save reached Cloud, but its acknowledgement was lost before the device folded it.
  const first = await save(records, "first", { recordId: "PS-1", replace: { title: "A" } });
  const folded = await prepareOrderedOperation(
    { operationId: "folded", supersedes: ["first"], edits: [{ recordId: "PS-1", replace: { title: "B" } }] },
    records,
  );
  expect(await verifyOrderedOperation(JSON.parse(JSON.stringify(folded)))).toEqual(folded);
  apply(records, first);
  expect(apply(records, folded).skipped).toEqual([]);
  expect(value(records)).toEqual({ title: "B" });
  // A different device's write after the superseded save still wins.
  const again = await prepareOrderedOperation(
    { operationId: "again", supersedes: ["folded"], edits: [{ recordId: "PS-1", replace: { title: "C" } }] },
    records,
  );
  apply(records, await save(records, "desktop", { recordId: "PS-1", replace: { title: "Desktop" } }));
  expect(apply(records, again).skipped[0]!.paths).toEqual(["/title"]);
});

test("a save spanning several records stays atomic when the base rule drops any part of it", async () => {
  const records = await seeded({ title: "Parent", children: [] });
  // Laptop creates a child and links it from PS-1 in one save.
  const laptop = await prepareOrderedOperation(
    {
      operationId: "laptop",
      edits: [
        { recordId: "PS-9", replace: { title: "Child" } },
        { recordId: "PS-1", changes: [{ path: ["children"], set: ["PS-9"] }] },
      ],
    },
    records,
  );
  apply(
    records,
    await save(records, "desktop", { recordId: "PS-1", changes: [{ path: ["children"], set: ["PS-5"] }] }),
  );
  expect(projectOrderedOperation(records, laptop)).toEqual([]);
  const result = apply(records, laptop);
  expect(result.decision.state).toBe("accepted");
  expect(records.has("PS-9")).toBe(false);
  expect(value(records)).toEqual({ title: "Parent", children: ["PS-5"] });
  expect(result.skipped).toEqual([
    { recordId: "PS-9", paths: ["/title"], whole: true },
    { recordId: "PS-1", paths: ["/children"], whole: true },
  ]);
});
