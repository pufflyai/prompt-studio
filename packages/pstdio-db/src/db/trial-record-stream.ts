import { constants, cpSync } from "node:fs";
import { open, readdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { PGlite, type PGliteOptions } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import {
  canonicalRecordFromRow,
  orderedRecordMetadata,
  stableRecordColumns,
} from "../services/extension-storage/ordered-record-row";
import { encodeProjectionValue } from "../services/extension-storage/record-projection-codec";
import type { DbClient } from "./connection.pglite";
import { flushDirectory } from "./pglite-home-recovery";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

declare const PSTDIO_TRIAL_RECORD_WORKER: string | undefined;

export const cloneClosedDatabase = (from: string, to: string) =>
  cpSync(from, to, { recursive: true, mode: constants.COPYFILE_FICLONE, errorOnExist: true, force: false });

export function startRecordPreparation(path: string) {
  const backup = `${path}.before-upgrade`;
  const started=performance.now();
  const mark=(phase:string)=>console.log("Upgrade diagnostic",phase,Math.round(performance.now()-started));
  cloneClosedDatabase(path, backup);mark("rollback copy");
  const worker = new Worker(
    typeof PSTDIO_TRIAL_RECORD_WORKER === "string"
      ? PSTDIO_TRIAL_RECORD_WORKER
      : new URL("./trial-record-worker.ts", import.meta.url).href,
  );
  const owners = Promise.withResolvers<string>(),
    completed = Promise.withResolvers<void>();
  function fail(error: Error) {
    owners.reject(error);
    completed.reject(error);
  }
  worker.onmessage = ({ data }) => {
    if (data.error) fail(Error(data.error));
    else if (data.completed) {mark("reader exports complete");completed.resolve();}
    else {mark("normalized records available");owners.resolve(data.owners);}
  };
  worker.onerror = (e) => fail(Error(e.message));
  void owners.promise.catch(() => {});
  void completed.promise.catch(() => {});
  worker.postMessage({ backup, path });
  return {
    options: (options: PGliteOptions) => ({
      ...options,
      startParams: [
        ...PGlite.defaultStartParams,
        "-c",
        "wal_level=minimal",
        "-c",
        "max_wal_senders=0",
        "-c",
        "max_wal_size=4096MB",
      ],
    }),
    assertApplicable: async (db: DbClient) => {
      const controls =
        await db.execute(sql`SELECT (SELECT count(*) FROM storage_ordered_operations WHERE settled_epoch IS NULL AND (envelope IS NOT NULL OR admission IS NOT NULL)) +
          (SELECT count(*) FROM storage_documents WHERE document_id='["ordered-conversion"]') +
          (SELECT count(*) FROM storage_record_outbox) +
          (SELECT count(*) FROM storage_record_projections c WHERE NOT EXISTS (SELECT 1 FROM storage_ordered_owners o WHERE (c.workbench_id,c.extension_id)=(o.workbench_id,o.extension_id))) AS n`);
      if (Number(controls.rows[0].n)) throw Error("Trial requires settled data");
    },
    seedOwners: async (db: DbClient) => {
      await db.execute(sql`INSERT INTO owners(project_id,extension_id)
        SELECT workbench_id,extension_id FROM storage_ordered_owners ORDER BY workbench_id COLLATE "C",extension_id COLLATE "C"`);
    },
    load: (db: DbClient) => streamOriginalTables(db, path, owners.promise,mark),
    cancel: () => worker.terminate(),
    async finish() {
      await completed.promise;
      const incoming = `${path}.verified-exports`,
        exports = `${path}-migration-exports`;
      for (const name of await readdir(incoming)) await rename(join(incoming, name), join(exports, name));
      await flushDirectory(exports);
      await rm(incoming, { recursive: true });
      await rm(backup, { recursive: true });
      await flushDirectory(dirname(path));
    },
  };
}

export async function retainOriginalTables(db: DbClient) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`CREATE SCHEMA upgrade_source`);
    await tx.execute(sql`ALTER TABLE asset_transfers SET SCHEMA upgrade_source`);
    await tx.execute(sql`CREATE TABLE asset_transfers (LIKE upgrade_source.asset_transfers INCLUDING DEFAULTS)`);
    await tx.execute(sql`ALTER TABLE asset_transfers ADD CONSTRAINT asset_transfers_project_id_projects_id_fk FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      ADD CONSTRAINT asset_transfers_project_id_extension_id_operation_id_pk PRIMARY KEY(project_id,extension_id,operation_id)`);
    await tx.execute(sql`ALTER TABLE storage_ordered_records SET SCHEMA upgrade_source`);
    await tx.execute(sql`ALTER TABLE storage_current_records SET SCHEMA upgrade_source`);
    await tx.execute(sql`DO $$ DECLARE item record; BEGIN
        FOR item IN SELECT conrelid::regclass AS rel,conname FROM pg_constraint
        WHERE contype='f' AND conrelid IN ('upgrade_source.storage_ordered_records'::regclass,'upgrade_source.storage_current_records'::regclass)
        LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',item.rel,item.conname); END LOOP; END $$`);
    await tx.execute(
      sql`CREATE TABLE storage_ordered_records (LIKE upgrade_source.storage_ordered_records INCLUDING DEFAULTS)`,
    );
    await tx.execute(
      sql`CREATE TABLE storage_current_records (LIKE upgrade_source.storage_current_records INCLUDING DEFAULTS)`,
    );
  });
}

interface ReleasedRow extends Record<string, unknown> {
  workbench_id: string;
  extension_id: string;
  record_id: string;
  canonical_id: string;
  deleted: boolean;
  state: string;
  live: string;
  revision: string | null;
  query_values: string;
  native_versions: string;
}
function normalizeRecord(r: ReleasedRow, ids: Map<string, number>) {
  const ownerId = ids.get(JSON.stringify([r.workbench_id, r.extension_id]));
  if (!ownerId || !r.record_id || r.canonical_id !== r.record_id) throw Error("Trial requires paired records");
  const canon = JSON.parse(r.state);
  if (canon.recordId !== r.record_id || canon.deleted !== r.deleted) throw Error("Trial record identity mismatch");
  const value = canon.deleted ? stableRecordColumns(canon) : JSON.parse(r.live);
  if (!canon.deleted) {
    value.meta = orderedRecordMetadata(canon);
    value.native_sources = encodeProjectionValue(value.native_sources);
  }
  const row = {
    owner_id: ownerId,
    record_id: r.record_id,
    deleted: r.deleted,
    ...value,
    revision: r.revision,
    query_values: JSON.parse(r.query_values),
    native_versions: JSON.parse(r.native_versions),
    base: null,
  };
  if (!isDeepStrictEqual(canonicalRecordFromRow(row), canon)) throw Error("Settled record disagreement");
  return row;
}

const fieldBytes = (value: Buffer | number | boolean | null) => {
  if (Buffer.isBuffer(value)) return value.length;
  if (typeof value === "number") return 4;
  return typeof value === "boolean" ? 1 : 0;
};
export async function writeTrialRecords(db: DbClient, path: string, sourceSchema = "upgrade_source") {
  const file = await open(path, "wx", 0o600);
  const fields = [
    "owner_id",
    "record_id",
    "deleted",
    "value",
    "query_values",
    "asset",
    "shared",
    "native_sources",
    "native_versions",
    "record_lifetime",
    "revision",
    "meta",
    "base",
  ];
  // PostgreSQL binary COPY uses a version byte before the UTF-8 rendering of JSONB.
  const textFields = new Set(["record_id", "record_lifetime", "revision"]);
  await file.writeFile(Buffer.from("5047434f50590aff0d0a000000000000000000", "hex"));
  const emptyJson = Buffer.from([1, 123, 125]);
  const encodeJson = (v: unknown) => {
    const text = JSON.stringify(v);
    return text === "{}" ? emptyJson : Buffer.from(`\x01${text}`);
  };
  const encoded = (row: Record<string, unknown>) => {
    const values = fields.map((k) => {
      const v = row[k];
      if (v == null) return null;
      if (k === "owner_id") return Number(v);
      if (k === "deleted") return Boolean(v);
      return textFields.has(k) ? Buffer.from(String(v)) : encodeJson(v);
    });
    const size = 2 + 4 * fields.length + values.reduce<number>((count, v) => count + fieldBytes(v), 0);
    const target = Buffer.allocUnsafe(size);
    target.writeInt16BE(fields.length);
    let offset = 2;
    for (const v of values) {
      if (v == null) {
        target.writeInt32BE(-1, offset);
        offset += 4;
      } else if (typeof v === "number") {
        target.writeInt32BE(4, offset);
        target.writeInt32BE(v, offset + 4);
        offset += 8;
      } else if (typeof v === "boolean") {
        target.writeInt32BE(1, offset);
        target[offset + 4] = v ? 1 : 0;
        offset += 5;
      } else {
        target.writeInt32BE(v.length, offset);
        v.copy(target, offset + 4);
        offset += 4 + v.length;
      }
    }
    return target;
  };

  try {
    await db.transaction(async (tx) => {
      const ownerRows = (
        await tx.execute<{ project_id: string; extension_id: string; id: number }>(
          sql`SELECT project_id,extension_id,id FROM owners`,
        )
      ).rows;
      const ids = new Map(ownerRows.map((o) => [JSON.stringify([o.project_id, o.extension_id]), o.id]));
      await tx.execute(sql`DECLARE migration_records NO SCROLL CURSOR FOR SELECT c.workbench_id,c.extension_id,c.record_id, r.record_id AS canonical_id, convert_from(r.state,'UTF8') AS state,
          c.revision,c.query_values::text,c.native_versions::text,c.deleted,
          CASE WHEN NOT c.deleted THEN json_build_object('value',c.value,'asset',c.asset,'shared',c.shared,
            'native_sources',c.native_sources,'record_lifetime',c.record_lifetime)::text END AS live
          FROM ${sql.identifier(sourceSchema)}.storage_current_records c FULL JOIN ${sql.identifier(sourceSchema)}.storage_ordered_records r USING(workbench_id,extension_id,record_id)`);
      for (;;) {
        const { rows } = await tx.execute<ReleasedRow>(sql`FETCH FORWARD 256 FROM migration_records`);
        if (!rows.length) break;
        const lines = rows.map((row) => encoded(normalizeRecord(row, ids)));
        await file.writeFile(Buffer.concat(lines));
      }
      await tx.execute(sql`CLOSE migration_records`);
    });
    await file.writeFile(Buffer.from([255, 255]));
  } finally {
    await file.close();
  }
}
async function streamOriginalTables(db: DbClient, path: string, preparing: Promise<string>,mark:(phase:string)=>void) {
  mark("begin loading");
  const filePath = join(path, "trial-records.copy");
  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO owners(project_id,extension_id) SELECT DISTINCT project_id,extension_id FROM upgrade_source.asset_transfers ON CONFLICT DO NOTHING`,
      );
      await tx.execute(
        sql`ALTER TABLE asset_transfers DROP CONSTRAINT asset_transfers_owner_id_owners_id_fk, DROP CONSTRAINT asset_transfers_owner_id_operation_id_pk`,
      );
      await tx.execute(sql`INSERT INTO asset_transfers(owner_id,operation_id,expected,cancelled_at,created_at)
        SELECT o.id,t.operation_id,t.expected,t.cancelled_at::timestamptz,t.created_at::timestamptz FROM upgrade_source.asset_transfers t JOIN owners o USING(project_id,extension_id)`);
      await tx.execute(sql`ALTER TABLE asset_transfers ADD CONSTRAINT asset_transfers_owner_id_owners_id_fk FOREIGN KEY(owner_id) REFERENCES owners(id) ON DELETE CASCADE,
        ADD CONSTRAINT asset_transfers_owner_id_operation_id_pk PRIMARY KEY(owner_id,operation_id)`);
      await tx.execute(
        sql`INSERT INTO owners(project_id,extension_id) SELECT workbench_id,extension_id FROM storage_ordered_owners ON CONFLICT DO NOTHING`,
      );
    });
    {
      const snapshot = await prepareUpgradeSnapshot(
        db,
        path,
        {
          table: "projects",
          name: "trial-canonical-archive",
          archive: "storage_ordered_records",
          select: sql`SELECT * FROM upgrade_source.storage_ordered_records`,
          keys: ["workbench_id", "extension_id", "record_id"],
          copyJson: true,
        },
        async () => {},
      );
      await snapshot?.complete();mark("canonical archive complete");
    }
    {
      const check = await preparing;
      const rows = (
        await db.execute(sql`SELECT project_id,extension_id,id FROM owners WHERE (project_id,extension_id) IN
        (SELECT workbench_id,extension_id FROM storage_ordered_owners) ORDER BY project_id COLLATE "C",extension_id COLLATE "C"`)
      ).rows;
      if (JSON.stringify(rows) !== check) throw Error("Prepared owner identities disagree");
    }
    await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL maintenance_work_mem='96MB'`);
      await tx.execute(sql`SET LOCAL work_mem='32MB'`);
      await tx.execute(
        sql`ALTER TABLE records DROP CONSTRAINT records_owner_id_owners_id_fk, DROP CONSTRAINT records_owner_id_record_id_pk`,
      );
      await tx.execute(sql`DROP INDEX records_native_sources_idx`);
      await tx.execute(sql`TRUNCATE records`);
      await tx.execute(sql`COPY records (owner_id,record_id,deleted,value,query_values,asset,shared,native_sources,native_versions,record_lifetime,revision,meta,base)
        FROM '/pglite/data/trial-records.copy' WITH (FORMAT BINARY)`);
      await tx.execute(sql`ALTER TABLE records ADD CONSTRAINT records_owner_id_record_id_pk PRIMARY KEY(owner_id,record_id),
        ADD CONSTRAINT records_owner_id_owners_id_fk FOREIGN KEY(owner_id) REFERENCES owners(id) ON DELETE CASCADE`);
      await tx.execute(sql`CREATE INDEX records_native_sources_idx ON records USING gin(native_sources)`);
      await tx.execute(sql`DROP SCHEMA upgrade_source CASCADE`);mark("bulk records and indexes complete");
    });
  } finally {
    await rm(filePath, { force: true });
  }
}
