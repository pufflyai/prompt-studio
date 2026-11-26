import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
  type OrderedRecord,
  orderedProjection,
  prepareOrderedOperation,
  projectOrderedOperation,
} from "pstdio-sync/records";
import { fingerprint } from "pstdio-sync-contracts";
import { createDocumentStorageDBService } from "../services/extension-storage/document-storage";
import { withOrderedOwner } from "../services/extension-storage/ordered-journal";
import { prepareOrderedAdmission, rebaseOrderedProjection } from "../services/extension-storage/ordered-rebase";
import { encodeOrderedJson } from "../services/extension-storage/ordered-sql";
import { encodeProjectionValue } from "../services/extension-storage/record-projection-codec";
import { createDb } from "./connection.pglite";
import { prepareDocumentOwnerUpgrade } from "./document-owner-upgrade";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { prepareOrderedOwnerUpgrade } from "./ordered-owner-upgrade";
import { prepareOwnerProjectionUpgrade } from "./owner-projection-upgrade";
import { prepareRecordRowFinalization } from "./record-row-upgrade";

const owner = { workbenchId: "project", extensionId: "example.records" };
const record = (recordId: string, title: string): OrderedRecord => ({
  recordId,
  value: { value: { title } },
  deleted: false,
  lifetime: "initial",
  stamps: { "": JSON.stringify(["canonical", "cloud", "seed"]) },
});
for (const interruption of ["normal", "schema", "restore"])
  test(`record consolidation keeps confirmed and query facets across ${interruption} and reopening`, async () => {
    const root = await mkdtemp(join(tmpdir(), "record-row-upgrade-"));
    const old = await createTextLogOwnerFixture(root);
    let closed = false,
      current: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      await old.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at) VALUES('project','Records','R','2026-11-22','2026-11-22');
      INSERT INTO storage_ordered_owners(workbench_id,extension_id,epoch,joined) VALUES('project','example.records','cloud',true);
      INSERT INTO storage_documents(workbench_id,extension_id,document_id,state,revision,folded_revision) VALUES('project','example.records','records',decode('0000','hex'),1,1);
      INSERT INTO storage_record_projections(workbench_id,extension_id,document_id,revision,live_count) VALUES('project','example.records','records',1,204)`);
      const confirmed = new Map(
        Array.from({ length: 201 }, (_, i) => {
          const r = record(`card-${String(i).padStart(3, "0")}`, `settled-${i}`);
          return [r.recordId, r] as const;
        }),
      );
      confirmed.set("hidden", record("hidden", "not published"));
      confirmed.set("pending", record("pending", "confirmed"));
      const input = await prepareOrderedOperation(
        {
          operationId: "queued",
          edits: [
            { recordId: "pending", replace: { value: { title: "pending" } } },
            { recordId: "z-created", replace: { value: { title: "new" } } },
          ],
        },
        confirmed,
      );
      const visible = new Map(confirmed);
      visible.delete("hidden");
      visible.set("orphan", record("orphan", "query only"));
      for (const r of projectOrderedOperation(confirmed, input)) visible.set(r.recordId, r);
      for (const r of confirmed.values())
        await old.pglite.query(
          `INSERT INTO storage_ordered_records(workbench_id,extension_id,record_id,state) VALUES($1,$2,$3,$4)`,
          [owner.workbenchId, owner.extensionId, r.recordId, encodeOrderedJson(r)],
        );
      for (const r of visible.values()) {
        const p = await orderedProjection(r);
        await old.pglite.query(
          `INSERT INTO storage_current_records(workbench_id,extension_id,record_id,deleted,value,asset,shared,native_sources,native_versions,record_lifetime,revision)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            owner.workbenchId,
            owner.extensionId,
            r.recordId,
            p.deleted,
            JSON.stringify(encodeProjectionValue(p.value)),
            null,
            null,
            JSON.stringify(p.nativeSources),
            "{}",
            r.lifetime,
            p.revision,
          ],
        );
      }
      await old.pglite.query(
        `INSERT INTO storage_ordered_operations(workbench_id,extension_id,operation_id,fingerprint,local_sequence,request_fingerprint,envelope)
      VALUES($1,$2,$3,$4,1,'request',$5)`,
        [owner.workbenchId, owner.extensionId, input.operationId, input.fingerprint, encodeOrderedJson(input)],
      );
      for (const edit of input.edits)
        await old.pglite.query(`INSERT INTO storage_ordered_touches VALUES($1,$2,$3,$4,1)`, [
          owner.workbenchId,
          owner.extensionId,
          edit.recordId,
          input.operationId,
        ]);
      if (interruption !== "normal") {
        await prepareRecordRowFinalization(old.db, old.path);
        await prepareOwnerProjectionUpgrade(old.db, old.path);
        const documents = await prepareDocumentOwnerUpgrade(old.db, old.path),
          ordered = await prepareOrderedOwnerUpgrade(old.db, old.path);
        await migrate(old.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
        if (interruption === "restore") {
          await ordered!();
          await old.pglite.exec(`CREATE FUNCTION interrupt_records() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.record_id='z-created' THEN RAISE EXCEPTION 'interrupt records'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER interrupt_records BEFORE INSERT ON records FOR EACH ROW EXECUTE FUNCTION interrupt_records()`);
          await expect(documents!()).rejects.toThrow("Failed query");
          expect(
            (await old.pglite.query<{ n: number }>("SELECT count(*)::int AS n FROM records WHERE revision IS NOT NULL"))
              .rows[0]!.n,
          ).toBe(200);
          await old.pglite.exec("DROP TRIGGER interrupt_records ON records");
        }
      }
      await old.close();
      closed = true;
      current = await createDb({ path: old.path });
      if (interruption === "normal") {
        const verifyLocal = async () => {
          const service = createDocumentStorageDBService(current!.db);
          const records = service.open({ owner }).records;
          expect((await records.read("pending")).value).toEqual({ title: "pending" });
          expect((await records.read("z-created")).value).toEqual({ title: "new" });
          expect((await records.read("orphan")).value).toEqual({ title: "query only" });
          await withOrderedOwner(current!.db, owner, async (journal) => {
            expect(await journal.pending()).toEqual([]);
            const visible = await journal.canonical(["pending", "z-created"]);
            expect(visible.get("pending")).toMatchObject({ value: { value: { title: "pending" } }, stamps: {} });
            expect(visible.get("z-created")).toMatchObject({ value: { value: { title: "new" } }, stamps: {} });
          });
          await service.flushStatistics();
        };
        await verifyLocal();
        await current.close();
        current = await createDb({ path: old.path });
        await verifyLocal();
        const service = createDocumentStorageDBService(current.db);
        const records = service.open({ owner }).records;
        await records.commit({ operationId: "new-save", edits: [{ recordId: "pending", set: { "/done": true } }] });
        expect((await records.read("pending")).value).toEqual({ title: "pending", done: true });
        await service.flushStatistics();
        return;
      }
      const verify = async () => {
        await withOrderedOwner(current!.db, owner, async (journal) => {
          expect(await journal.canonical([...confirmed.keys(), "orphan", "z-created"])).toEqual(confirmed);
          expect(await journal.pending()).toMatchObject([{ operation: input, requestFingerprint: "request" }]);
        });
        const service = createDocumentStorageDBService(current!.db),
          records = service.open({ owner }).records;
        expect(await records.read("hidden")).toMatchObject({ exists: false });
        expect(await records.read("orphan")).toMatchObject({ value: { title: "query only" } });
        expect(await records.read("pending")).toMatchObject({ value: { title: "pending" } });
        const rows = (
          await current!.pglite.query<{ record_id: string; base: Uint8Array }>(
            "SELECT record_id,base FROM records WHERE base IS NOT NULL ORDER BY record_id",
          )
        ).rows;
        expect(rows.map((row) => row.record_id)).toEqual(["pending", "z-created"]);
        expect(JSON.parse(Buffer.from(rows[0]!.base).toString())).toEqual(confirmed.get("pending"));
        expect(JSON.parse(Buffer.from(rows[1]!.base).toString())).toBeNull();
        expect(
          (
            await current!.pglite.query<{ n: number }>(
              "SELECT live_count::int AS n FROM owners WHERE extension_id='example.records'",
            )
          ).rows[0]!.n,
        ).toBe(204);
        await service.flushStatistics();
      };
      await verify();
      await current.close();
      current = await createDb({ path: old.path });
      await verify();
      expect(await Bun.file(`${old.path}-record-row-finalization-upgrade.jsonl`).exists()).toBe(false);
      await withOrderedOwner(current.db, owner, async (journal, tx) => {
        const admission = await prepareOrderedAdmission(journal, input, "cloud");
        await journal.recordDecision(
          { epoch: "cloud", operationId: input.operationId, fingerprint: input.fingerprint, state: "refused" },
          await fingerprint(admission as never),
        );
        await rebaseOrderedProjection(journal, tx, owner, ["pending", "z-created"]);
      });
      expect((await current.pglite.query("SELECT record_id FROM records WHERE base IS NOT NULL")).rows).toEqual([]);
      const service = createDocumentStorageDBService(current.db),
        records = service.open({ owner }).records;
      expect(await records.read("pending")).toMatchObject({ value: { title: "confirmed" } });
      expect(await records.read("z-created")).toMatchObject({ exists: false });
      await service.flushStatistics();
    } finally {
      if (!closed) await old.close();
      await current?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
