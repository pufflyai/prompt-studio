import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createDocumentStorageDBService } from "../services/extension-storage/document-storage";
import { createExtensionStorageFixture } from "../services/extension-storage/extension-storage.fixture";
import { createOrderedLogStore } from "../services/extension-storage/ordered-log-store";
import { createDb } from "./connection.pglite";
import { createRetiredStorageCleanup } from "./retired-storage-cleanup";
import { owners, storage_current_records } from "./schemas.pg";

for (const mode of ["startup", "deferred"] as const)
  test(`${mode} cleanup removes retired record data and preserves current records and owner logs`, async () => {
    const root = await mkdtemp(join(tmpdir(), "pstdio-retired-records-"));
    const path = join(root, "database");
    const f = await createExtensionStorageFixture(path);
    let close = f.close;
    let db = f.db;
    try {
      const retired = {
        workbenchId: f.projectAId,
        extensionId: JSON.stringify(["pstdio.personal-history", "https://manager.example", "alice"]),
      };
      const current = { ...retired, extensionId: "example.current" };
      const service = createDocumentStorageDBService(db);
      for (const owner of [retired, current])
        await service.open({ owner }).records.commit({
          operationId: "save",
          edits: [{ recordId: "one", replace: { title: "Keep until cleanup" } }],
        });
      const log = createOrderedLogStore(db, {
        owner: retired,
        name: "events",
        scope: "project",
        stream: "writer",
        writerId: "writer",
      });
      await log.append({ text: "Keep this log" });
      const [before] = await db.select().from(owners).where(eq(owners.extension_id, retired.extensionId));
      expect(before!.live_count).toBe(1);
      if (mode === "startup") {
        await close();
        const reopened = await createDb({ path });
        db = reopened.db;
        close = reopened.close;
      } else await createRetiredStorageCleanup(db, path, [])(() => false);
      expect(
        await db.select().from(storage_current_records).where(eq(storage_current_records.owner_id, before!.id)),
      ).toEqual([]);
      const [after] = await db.select().from(owners).where(eq(owners.id, before!.id));
      expect({ revision: after!.revision, count: after!.live_count }).toEqual({
        revision: before!.revision + 1,
        count: 0,
      });
      expect(await createDocumentStorageDBService(db).open({ owner: current }).records.list()).toHaveLength(1);
      const remaining = await createOrderedLogStore(db, {
        owner: retired,
        name: "events",
        scope: "project",
        stream: "writer",
        writerId: "writer",
      }).read();
      expect(remaining.entries.map((entry) => entry.value)).toEqual([{ text: "Keep this log" }]);
    } finally {
      await close();
      await rm(root, { recursive: true, force: true });
    }
  });
