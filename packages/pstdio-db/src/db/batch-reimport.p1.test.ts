import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { stageBatchReimport } from "./batch-reimport";
import { batchBackup, batchPayload, recoverBatchHome } from "./batch-reimport-home";
import { createDb, resolvePgliteOptions } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { openPglite } from "./open-pglite";

async function seed(old: Awaited<ReturnType<typeof createTextLogOwnerFixture>>) {
  const encoded = (value: string) => Buffer.from(value).toString("base64url");
  const uploads = join(
    dirname(old.path),
    "storage",
    "asset-bytes",
    encoded("p"),
    encoded("example.records"),
    "transfers",
  );
  await mkdir(uploads, { recursive: true });
  await writeFile(join(uploads, encoded("transfer")), "partial");
  await old.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
          VALUES ('p','Before','P','2026-11-01','2026-11-01');
          INSERT INTO storage_ordered_owners(workbench_id,extension_id,epoch) VALUES ('p','example.records','local:p');
          INSERT INTO storage_documents(workbench_id,extension_id,document_id,state) VALUES ('p','example.records','records',decode('0000','hex'));
          INSERT INTO storage_record_projections(workbench_id,extension_id,document_id,revision,live_count) VALUES ('p','example.records','records',42,1);
          INSERT INTO storage_current_records(workbench_id,extension_id,record_id,deleted,value,revision,record_lifetime)
          VALUES ('p','example.records','r',false,'{"title":"saved"}','42','initial');
          INSERT INTO storage_ordered_records VALUES ('p','example.records','r',
          convert_to('{"recordId":"r","value":{"value":{"title":"saved"}},"deleted":false,"lifetime":"initial","stamps":{}}','UTF8'));
          INSERT INTO asset_transfers VALUES ('p','example.records','transfer','{"byteLength":10}',NULL,'2026-11-01'),
            ('p','example.records','finished','{"byteLength":9}',NULL,'2026-11-01');
          INSERT INTO storage_current_records(workbench_id,extension_id,record_id,deleted,revision,record_lifetime)
            VALUES ('p','example.records','deleted-file',true,'41','initial');
          INSERT INTO storage_ordered_records VALUES ('p','example.records','deleted-file',
            convert_to('{"recordId":"deleted-file","value":null,"deleted":true,"lifetime":"initial","stamps":{}}','UTF8'));
          UPDATE storage_ordered_owners SET joined=true,"after"=23,state_id='old-cloud' WHERE workbench_id='p';
          INSERT INTO storage_personal_history (workbench_id,extension_id,device_id,kind,record_id,value,pending_id)
            VALUES ('p','example.records','laptop','sessions','recent','{"title":"local session"}','old-save');
          INSERT INTO storage_personal_history_sources(workbench_id,extension_id,source_id,kind,device_id,record_id,value,entry_id,sequence,entry_index)
            VALUES ('p','example.records','laptop','sessions','laptop','recent','{}','old-entry',3,0);
          INSERT INTO storage_documents(workbench_id,extension_id,document_id,state)
            VALUES ('p','example.records','["ordered-directory"]',decode('0000','hex')),
                   ('p','example.records','["ordered-native-field","old"]',decode('0000','hex')),
                   ('p','example.records','["ordered-shopping-list","draft"]',decode('0000','hex'));
          INSERT INTO storage_ordered_operations(workbench_id,extension_id,operation_id,fingerprint) VALUES ('p','example.records','obsolete','fp');
          INSERT INTO storage_ordered_receipts(workbench_id,extension_id,epoch,operation_id,admission_fingerprint,state,indexed)
          VALUES ('p','example.records','local:p','obsolete','fp','accepted',true);`);
}

for (const lastMigration of [7, 9, 10]) {
  test(`batch re-import preserves a released project and its source through migration ${lastMigration}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "batch-reimport-"));
    const old = await createTextLogOwnerFixture(root, lastMigration);
    const source = `${old.path}.before-0.49`;
    try {
      try {
        await seed(old);
      } finally {
        await old.close();
      }
      const db = await createDb({ path: old.path });
      try {
        expect(existsSync(source)).toBe(true);
        expect((await db.pglite.query("SELECT value,revision FROM records")).rows).toEqual([
          { value: { title: "saved" }, revision: "42" },
        ]);
        expect((await db.pglite.query("SELECT operation_id FROM asset_transfers")).rows).toEqual([
          { operation_id: "transfer" },
        ]);
        expect((await db.pglite.query("SELECT count(*)::int n FROM operations")).rows).toEqual([{ n: 0 }]);
        expect(
          (
            await db.pglite.query(
              "SELECT epoch,joined,\"after\",state_id FROM owners WHERE extension_id='example.records'",
            )
          ).rows,
        ).toEqual([{ epoch: null, joined: false, after: 0, state_id: null }]);
        expect((await db.pglite.query("SELECT value,pending_id FROM history_rows")).rows).toEqual([
          { value: { title: "local session" }, pending_id: null },
        ]);
        expect((await db.pglite.query("SELECT 1 FROM history_sources")).rows).toEqual([]);
        expect((await db.pglite.query(`SELECT key FROM documents WHERE starts_with(key,'["ordered-')`)).rows).toEqual([
          { key: '["ordered-shopping-list","draft"]' },
        ]);
        await db.pglite.exec("UPDATE projects SET name='After' WHERE id='p'");
      } finally {
        await db.close();
      }
      const reopened = await createDb({ path: old.path });
      try {
        expect((await reopened.pglite.query("SELECT name FROM projects")).rows).toEqual([{ name: "After" }]);
      } finally {
        await reopened.close();
      }
      const original = await openPglite(source, await resolvePgliteOptions());
      try {
        expect((await original.query("SELECT name FROM projects")).rows).toEqual([{ name: "Before" }]);
        expect((await original.query("SELECT operation_id FROM storage_ordered_receipts")).rows).toEqual([
          { operation_id: "obsolete" },
        ]);
      } finally {
        await original.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("reopens the original after an unsupported pair and preserves a projection-only record", async () => {
  const root = await mkdtemp(join(tmpdir(), "reimport-admission-"));
  try {
    const old = await createTextLogOwnerFixture(root, 9);
    try {
      await seed(old);
      await old.pglite.exec(`INSERT INTO storage_ordered_records(workbench_id,extension_id,record_id,state)
        VALUES ('p','example.records','unpublished',decode('0000','hex'))`);
      expect(
        await stageBatchReimport(
          old.pglite,
          old.path,
          await resolvePgliteOptions(),
          join(import.meta.dirname, "../../drizzle-0.46"),
        ),
      ).toBe(false);
      await old.pglite.exec("DELETE FROM storage_ordered_records WHERE record_id='unpublished'");
      await old.pglite.exec(
        "INSERT INTO storage_current_records(workbench_id,extension_id,record_id,deleted,value,revision,record_lifetime) VALUES ('p','example.records','projection-only',false,'123','7','initial')",
      );
    } finally {
      await old.close();
    }
    const db = await createDb({ path: old.path });
    try {
      expect(existsSync(batchBackup(old.path))).toBe(false);
      expect(
        (await db.pglite.query("SELECT value,revision FROM records WHERE record_id='projection-only'")).rows,
      ).toEqual([{ value: 123, revision: "7" }]);
      expect((await db.pglite.query("SELECT count(*)::int n FROM records")).rows).toEqual([{ n: 2 }]);
    } finally {
      await db.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resumes a published batch after interruption between directory renames and after DDL", async () => {
  const root = await mkdtemp(join(tmpdir(), "reimport-interrupted-"));
  try {
    const old = await createTextLogOwnerFixture(root, 9);
    try {
      await seed(old);
      const tryStage = async () =>
        stageBatchReimport(
          old.pglite,
          old.path,
          await resolvePgliteOptions(),
          join(import.meta.dirname, "../../drizzle-0.46"),
        );
      // An extension can have documents before it has an ordered owner.
      await old.pglite.exec(`INSERT INTO storage_documents(workbench_id,extension_id,document_id,state)
        VALUES ('p','document-only','["ordered-conversion"]',decode('0000','hex'))`);
      expect(await tryStage()).toBe(false);
      await old.pglite.exec("DELETE FROM storage_documents WHERE extension_id='document-only'");
      expect(await tryStage()).toBe(true);
    } finally {
      await old.close();
    }
    await rename(old.path, batchBackup(old.path));
    await recoverBatchHome(old.path);
    const recordFile = join(old.path, batchPayload, "records.copy");
    await rename(recordFile, `${recordFile}.held`);
    await expect(createDb({ path: old.path })).rejects.toThrow();
    const interrupted = await openPglite(old.path, await resolvePgliteOptions());
    try {
      expect(
        (
          await interrupted.query(
            "SELECT to_regnamespace('pstdio_import_048') IS NOT NULL AS pending, (SELECT count(*)::int FROM records) AS rows",
          )
        ).rows,
      ).toEqual([{ pending: true, rows: 0 }]);
    } finally {
      await interrupted.close();
    }
    await rename(`${recordFile}.held`, recordFile);
    const db = await createDb({ path: old.path });
    try {
      expect((await db.pglite.query("SELECT record_id FROM records")).rows).toEqual([{ record_id: "r" }]);
      expect((await db.pglite.query("SELECT operation_id FROM asset_transfers")).rows).toEqual([
        { operation_id: "transfer" },
      ]);
      expect(existsSync(join(old.path, batchPayload))).toBe(false);
      expect(existsSync(batchBackup(old.path))).toBe(true);
    } finally {
      await db.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
