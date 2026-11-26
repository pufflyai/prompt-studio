import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { findReport, reportLookupIndex } from "./report-lookup";

test("workspace and named lookups need no collection list except to break historical ties", async () => {
  const storage = createMemoryStorage({ indexes: [reportLookupIndex] });
  const collection = storage.collection("reports");
  for (const [id, name, workspaceShorthand] of [
    ["one", "plan", "A"],
    ["two", "review", "B"],
    ["three", "plan", "B"],
  ])
    await collection.put(id, { id, name, workspaceShorthand });
  const indexed = {
    ...storage,
    collection: () => {
      throw new Error("unexpected collection list");
    },
  };
  expect(await findReport(indexed, "A")).toEqual({ id: "one", name: "plan" });
  expect(await findReport(indexed, "B", "plan")).toEqual({ id: "three", name: "plan" });
  expect(await findReport(indexed, "B", "missing")).toBeNull();
  await expect(findReport(indexed, "missing")).rejects.toThrow("zero or multiple");
  await expect(findReport(indexed, "B")).rejects.toThrow("zero or multiple");
  await collection.put("four", { id: "four", name: "plan", workspaceShorthand: "B" });
  const legacy = ((await collection.list()) as { id: string; name: string; workspaceShorthand: string }[]).find(
    (r) => r.name === "plan" && r.workspaceShorthand === "B",
  );
  expect((await findReport(storage, "B", "plan"))?.id).toBe(legacy!.id);
});
