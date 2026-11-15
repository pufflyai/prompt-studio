import { expect, test } from "bun:test";
import { createMemoryStorage } from "../testing/memory-storage";
import { readCollectionRecords } from "./collection-records";

test("collection indexes select only their collection and storage scope", async () => {
  const storage = createMemoryStorage();
  const scoped = storage.scope({ type: "resource", resource: { type: "ticket", id: "selected" } });
  const definition = {
    name: "related",
    fields: { ticketId: { path: ["ticketId"], type: "string" as const } },
    equality: ["ticketId"],
  };
  await storage.collection("requests").put("project", { ticketId: "t" });
  await scoped.collection("requests").put("resource", { ticketId: "t" });
  await storage.collection("attempts").put("attempt", { ticketId: "t" });
  for (const [scope, expected] of [
    [storage, "project"],
    [scoped, "resource"],
  ] as const) {
    const index = { ...definition, collection: "requests" };
    await scope.records.defineIndexes([index]);
    const page = await scope.records.query({ index: index.name, where: { field: "ticketId", op: "eq", value: "t" } });
    expect(page.records).toHaveLength(1);
    expect(page.records[0].fields).toEqual({ ticketId: "t" });
    expect(
      await readCollectionRecords(
        scope,
        page.records.map(({ recordId }) => recordId),
      ),
    ).toEqual([{ ticketId: "t" }]);
    const record = await scope.records.read(page.records[0].recordId);
    expect(record.value).toEqual({ value: { ticketId: "t" }, sortOrder: null });
    expect(page.records[0].recordId).toContain(expected === "resource" ? "selected" : "project");
  }
});

test("collection selection derivations resolve both source paths within the collection item", async () => {
  const storage = createMemoryStorage();
  await storage.collection("choices").put("item", { legacy: "a", delta: { type: "single", value: "b" } });
  await storage.records.defineIndexes([
    {
      name: "selected",
      collection: "choices",
      fields: {
        selected: { path: ["legacy"], type: "array", derive: { kind: "selection", selectionPath: ["delta"] } },
      },
    },
  ]);
  expect((await storage.records.query({ index: "selected" })).records[0].fields.selected).toEqual(["b"]);
});
