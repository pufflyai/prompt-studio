import { expect, test } from "bun:test";
import { connectMemoryQueryResources } from "./memory-query-resources";
import { createMemoryStorage } from "./memory-storage";

test("memory queries apply core identities before LIMIT and invalidate cursors after renumbering", async () => {
  const storage = createMemoryStorage({
    indexes: [
      {
        name: "things",
        collection: "things",
        fields: {
          id: { path: ["id"], type: "string" },
          shorthand: { path: ["unused"], type: "string" },
        },
        identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
        orderBy: [{ field: "id", direction: "asc" }],
      },
    ],
  });
  const identities = new Map(
    ["b", "c"].map((id, index) => [id, { id, kind: "thing", shorthand: `X-${index + 2}`, aliases: [] as string[] }]),
  );
  connectMemoryQueryResources(storage, { identity: async ({ id }) => identities.get(id) ?? null });
  for (const id of ["a", "b", "c"]) await storage.collection("things").put(id, { id });
  const first = await storage.records.query({ index: "things", limit: 1 });
  expect(first.records[0].fields).toEqual({ id: "b", shorthand: "X-2" });
  expect((await storage.records.aggregate({ index: "things" })).count).toBe(2);
  identities.get("b")!.shorthand = "X-8";
  await expect(storage.records.query({ index: "things", cursor: first.cursor!, limit: 1 })).rejects.toThrow("stale");
});
