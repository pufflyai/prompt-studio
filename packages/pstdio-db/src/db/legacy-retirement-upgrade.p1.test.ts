import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { editResourceDocument } from "pstdio-sync/records";
import { createRecordStreamSync, encodeRecordFrame } from "pstdio-sync/relay";
import { createDocumentStorageDBService } from "../services/extension-storage/document-storage";
import { createAssets, createRelay } from "../services/extension-storage/record-stream-relay.fixture";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";

for (const resumeEpoch of [null, "local:released"])
  test(`released pending saves ${resumeEpoch ? "with an interrupted local epoch" : "without an ordered epoch"} join after migration retires the legacy inputs`, async () => {
    const root = await mkdtemp(join(tmpdir(), "legacy-retirement-upgrade-"));
    const previous = await createTextLogOwnerFixture(root);
    const owner = { workbenchId: "project", extensionId: "example.cards" };
    let previousClosed = false;
    let connection: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      await previous.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
      VALUES ('project','Upgrade','U','2026-11-22T11:00:00.000Z','2026-11-22T11:00:00.000Z')`);
      const resource = await editResourceDocument([], { recordId: "card", replace: { title: "saved" } }, true);
      await previous.pglite.query(
        `INSERT INTO storage_documents (workbench_id,extension_id,document_id,state)
      VALUES ('project',$1,'records',decode('0000','hex')),('project',$1,'["resource","card"]',$2)`,
        [owner.extensionId, resource.checkpoint],
      );
      await previous.pglite.query(
        `INSERT INTO storage_record_projections
      (workbench_id,extension_id,document_id,revision,live_count) VALUES ('project',$1,'records',1,1)`,
        [owner.extensionId],
      );
      await previous.pglite.query(
        `INSERT INTO storage_current_records (workbench_id,extension_id,record_id,deleted,value,revision)
      VALUES ('project',$1,'card',false,$2,$3)`,
        [owner.extensionId, JSON.stringify(resource.record.value), resource.record.revision],
      );
      await previous.pglite.query(
        `INSERT INTO storage_record_sync (workbench_id,extension_id,joined) VALUES ('project',$1,true)`,
        [owner.extensionId],
      );
      await previous.pglite.query(
        `INSERT INTO storage_record_outbox (workbench_id,extension_id,frame) VALUES ('project',$1,$2)`,
        [
          owner.extensionId,
          encodeRecordFrame({ records: [{ recordId: "card", bytes: resource.update! }], assets: [] }),
        ],
      );
      if (resumeEpoch) {
        await previous.pglite.query(
          `INSERT INTO storage_ordered_owners(workbench_id,extension_id,epoch)
        VALUES ('project',$1,$2)`,
          [owner.extensionId, resumeEpoch],
        );
        await previous.pglite.query(
          `INSERT INTO storage_documents(workbench_id,extension_id,document_id,state)
        VALUES ('project',$1,'["ordered-conversion"]',$2)`,
          [owner.extensionId, new TextEncoder().encode(JSON.stringify({ phase: "records" }))],
        );
      }
      await previous.close();
      previousClosed = true;

      connection = await createDb({ path: previous.path });
      const service = createDocumentStorageDBService(connection.db);
      const assets = createAssets();
      const records = service.open({ owner, assets: assets.store }).records;
      const store = service.documents.recordStream(owner);
      expect((await records.read("card")).value).toEqual({ title: "saved" });
      expect(await store.pending()).toBe(true);
      expect(
        (
          await connection.pglite.query(`SELECT to_regclass('storage_record_sync') AS sync,
        to_regclass('storage_record_outbox') AS outbox, to_regclass('storage_ordered_owners') AS ordered`)
        ).rows,
      ).toEqual([{ sync: null, outbox: null, ordered: null }]);
      expect(
        (
          await connection.pglite.query(`SELECT document_id FROM storage_documents
        WHERE document_id='["resource","card"]'`)
        ).rows,
      ).toEqual([]);
      expect(
        (await connection.pglite.query("SELECT joined,epoch FROM owners WHERE extension_id=$1", [owner.extensionId]))
          .rows,
      ).toEqual([{ joined: true, epoch: resumeEpoch }]);
      // Legacy Cloud admission must survive without skipping the first ordered transport join.
      expect((await store.open()).joined).toBe(false);
      if (resumeEpoch) {
        await service.cloudReturn.signOut();
        expect((await service.cloudReturn.status(owner.workbenchId)).state).toBe("signed-out");
        await service.cloudReturn.release([owner.workbenchId]);
      }
      await records.commit({ operationId: "after-upgrade", edits: [{ recordId: "card", set: { "/note": "new" } }] });
      const space = await createSyncSpace({
        projectId: owner.workbenchId,
        spaceOwner: null,
        keys: [{ generation: 1, secret: "A".repeat(43) }],
      });
      const failures: unknown[] = [];
      const sync = createRecordStreamSync({
        space,
        documentId: await space.documentId("ordered"),
        relay: createRelay().relay,
        store,
        assets: assets.store,
        quarantine: async (failure) => {
          failures.push(failure);
        },
      });
      await sync.synchronize();
      expect(failures).toEqual([]);
      expect((await store.open()).joined).toBe(true);
      expect(await store.pending()).toBe(false);
      expect((await records.read("card")).value).toEqual({ title: "saved", note: "new" });
      await service.flushStatistics();
      await connection.close();
      connection = undefined;

      connection = await createDb({ path: previous.path });
      const reopened = createDocumentStorageDBService(connection.db);
      expect((await reopened.open({ owner }).records.read("card")).value).toEqual({ title: "saved", note: "new" });
      expect(await reopened.documents.recordStream(owner).pending()).toBe(false);
      await reopened.flushStatistics();
    } finally {
      await connection?.close();
      if (!previousClosed) await previous.close();
      await rm(root, { recursive: true, force: true });
    }
  });
