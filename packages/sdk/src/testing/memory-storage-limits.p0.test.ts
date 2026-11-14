import { expect, test } from "bun:test";
import { isStorageLimitError, storageLimits } from "../extensions";
import { createMemoryStorage } from "./memory-storage";

const oversized = "x".repeat(storageLimits.recordBytes);

test("extension test storage refuses records over the record limit like the host", async () => {
  const storage = createMemoryStorage();
  const refused = [
    await storage.records
      .commit({ operationId: "save", edits: [{ recordId: storage.records.id("note"), replace: oversized }] })
      .catch((error: unknown) => error),
    await storage.set("note", oversized).catch((error: unknown) => error),
    await storage
      .collection("notes")
      .put("note", { body: oversized })
      .catch((error: unknown) => error),
  ];
  for (const error of refused) {
    expect(isStorageLimitError(error)).toBe(true);
    if (isStorageLimitError(error)) expect(error.data.maxBytes).toBe(storageLimits.recordBytes);
  }
  expect(await storage.get("note")).toBeUndefined();
  expect(await storage.collection("notes").list()).toEqual([]);
});
