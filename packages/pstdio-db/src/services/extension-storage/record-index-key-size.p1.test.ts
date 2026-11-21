import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("indexes admit long record identities and preserve ordering and cursors beyond their shared prefix", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const records = createDocumentStorageDBService(f.db).open({
      owner: { workbenchId: f.projectAId, extensionId: "ext.example" },
    }).records;
    const prefix = Array.from({ length: 36 }, (_, i) => createHash("sha256").update(String(i)).digest("hex")).join("");
    const ids = ["d", "b", "f", "e", "a", "c"].map((suffix) => `event/${prefix}/${suffix}`);
    const fields = {
      attemptId: { path: ["attemptId"], type: "string" as const },
      createdAt: { path: ["createdAt"], type: "string" as const },
      id: { path: ["id"], type: "string" as const },
    };
    await records.commit({
      operationId: "seed-long-identities",
      edits: ids.map((recordId) => ({
        recordId,
        replace: { id: recordId, attemptId: "attempt", createdAt: "2026-11-21T00:00:00.000Z" },
      })),
    });
    await records.defineIndexes([
      {
        name: "events",
        prefix: "event/",
        fields,
        equality: ["attemptId"],
        orderBy: [
          { field: "createdAt", direction: "asc" },
          { field: "id", direction: "asc" },
        ],
        alternateOrders: [[{ field: "createdAt", direction: "asc" }]],
      },
      { name: "identities", prefix: "event/", fields },
    ]);
    for (const query of [
      { index: "events" },
      { index: "identities" },
      { index: "events", orderBy: [{ field: "createdAt", direction: "asc" as const }] },
    ]) {
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await records.query({ ...query, limit: 2, cursor });
        expect(page.records).toHaveLength(2);
        seen.push(...page.records.map(({ recordId }) => recordId));
        cursor = page.cursor ?? undefined;
      } while (cursor);
      expect(seen).toEqual([...ids].sort());
    }
  } finally {
    await f.close();
  }
});
