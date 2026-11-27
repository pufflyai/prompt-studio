import { sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { decodeUpgradeBytes } from "./upgrade-bytes";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type UpgradeTx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

function logBatch(db: DbClient, restore: (tx: UpgradeTx, values: string) => Promise<void>) {
  const rows: string[] = [];
  let bytes = 0;
  const flush = async () => {
    if (!rows.length) return;
    const values = `[${rows.splice(0).join(",")}]`;
    bytes = 0;
    await db.transaction((tx) => restore(tx, values));
  };
  const add = async (row: Record<string, unknown>) => {
    const json = JSON.stringify(row);
    const size = Buffer.byteLength(json);
    if (rows.length && (rows.length >= 200 || bytes + size > 4 * 1024 * 1024)) await flush();
    rows.push(json);
    bytes += size;
  };
  return { add, flush };
}

const restoreLogStreams = async (tx: UpgradeTx, values: string) => {
  const input = sql`jsonb_to_recordset(${values}::jsonb) AS i(workbench_id text, extension_id text,
    log_name text, scope text, stream text, head bigint, complete_through bigint, state_id text, through bigint)`;
  await tx.execute(sql`INSERT INTO owners(project_id,extension_id)
    SELECT DISTINCT workbench_id,extension_id FROM ${input}
    ON CONFLICT(project_id,extension_id) DO NOTHING`);
  const mapped = sql`SELECT o.id AS owner_id, i.log_name,i.scope,i.stream,i.head,i.complete_through,i.state_id,i.through
    FROM ${input} JOIN owners o ON (o.project_id,o.extension_id)=(i.workbench_id,i.extension_id)`;
  await tx.execute(sql`INSERT INTO log_streams(owner_id,log_name,scope,stream,head,complete_through,state_id,through)
    ${mapped} ON CONFLICT(owner_id,log_name,scope,stream) DO NOTHING`);
  const conflict = await tx.execute(sql`WITH expected AS (${mapped})
    SELECT 1 FROM expected e LEFT JOIN log_streams s USING(owner_id,log_name,scope,stream)
    WHERE s.id IS NULL OR (s.head,s.complete_through,s.state_id,s.through)
      IS DISTINCT FROM (e.head,e.complete_through,e.state_id,e.through) LIMIT 1`);
  if (conflict.rows.length) throw new Error("Log stream restoration conflict");
};

const restoreLogEntries = async (tx: UpgradeTx, values: string) => {
  const mapped = sql`SELECT s.id AS stream_id,i.entry_id,i.writer_id,i.created_at,i.fingerprint,i.entry,
    i.local_sequence,i.local,i.relay_sequence,i.relay_index,i.envelope
    FROM jsonb_to_recordset(${values}::jsonb) AS i(workbench_id text, extension_id text, log_name text, scope text,
      stream text, entry_id text, writer_id text, created_at bigint, fingerprint text, entry bytea,
      local_sequence bigint, local boolean, relay_sequence bigint, relay_index integer, envelope bytea)
    LEFT JOIN owners o ON (o.project_id,o.extension_id)=(i.workbench_id,i.extension_id)
    LEFT JOIN log_streams s ON (s.owner_id,s.log_name,s.scope,s.stream)=(o.id,i.log_name,i.scope,i.stream)`;
  // A missing parent produces a NULL stream_id and fails the transaction. A replay must
  // match every stored byte and cursor, even when a different entry has the same address.
  await tx.execute(sql`INSERT INTO log_entries(stream_id,entry_id,writer_id,created_at,fingerprint,entry,
    local_sequence,local,relay_sequence,relay_index,envelope) ${mapped} ON CONFLICT(stream_id,entry_id) DO NOTHING`);
  const conflict = await tx.execute(sql`WITH expected AS (${mapped})
    SELECT 1 FROM expected e LEFT JOIN log_entries a USING(stream_id,entry_id)
    WHERE a.stream_id IS NULL OR (a.writer_id,a.created_at,a.fingerprint,a.entry,a.local_sequence,a.local,
      a.relay_sequence,a.relay_index,a.envelope) IS DISTINCT FROM
      (e.writer_id,e.created_at,e.fingerprint,e.entry,e.local_sequence,e.local,e.relay_sequence,e.relay_index,e.envelope)
    LIMIT 1`);
  if (conflict.rows.length) throw new Error("Log entry restoration conflict");
};

/** Capture both released tables before generated DDL; keep exact rows for recovery. */
export const prepareLogOwnerUpgrade = async (db: DbClient, path: string) => {
  let sequence: { lastValue: number; called: boolean } | undefined;
  const restoreSequence = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_log_entries_local_sequence_seq",
      keys: ["last_value"],
      name: "log-local-sequence",
      archive: "log-local-sequence",
    },
    async (row) => {
      if (typeof row.is_called !== "boolean") throw new Error("Invalid exported log sequence");
      sequence = { lastValue: Number(row.last_value), called: row.is_called };
    },
  );
  const streamBatch = logBatch(db, restoreLogStreams);
  const restoreStreams = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_log_streams",
      keys: ["workbench_id", "extension_id", "log_name", "scope", "stream"],
      name: "log-stream-owners",
      copyJson: true,
      archive: "log-streams",
    },
    streamBatch.add,
  );
  const entryBatch = logBatch(db, restoreLogEntries);
  const restoreEntries = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_log_entries",
      keys: ["workbench_id", "extension_id", "log_name", "scope", "stream", "entry_id"],
      name: "log-entry-streams",
      copyJson: true,
      archive: "log-entries",
    },
    async (row) => {
      decodeUpgradeBytes(row.entry);
      if (row.envelope !== null) decodeUpgradeBytes(row.envelope);
      await entryBatch.add(row);
    },
    async (row) => ({
      ...row,
      entry: `\\x${Buffer.from(row.entry as Uint8Array).toString("hex")}`,
      envelope: row.envelope === null ? null : `\\x${Buffer.from(row.envelope as Uint8Array).toString("hex")}`,
    }),
  );
  if (!restoreStreams && !restoreEntries && !restoreSequence) return;
  return async () => {
    await restoreStreams?.(true);
    await streamBatch.flush();
    await restoreEntries?.(true);
    await entryBatch.flush();
    await restoreSequence?.(true);
    // Public cursors can name rows already removed by retention: preserve the sequence,
    // not just the maximum position of the entries that survived.
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('log_entries', 'local_sequence'),
      GREATEST(COALESCE((SELECT max(local_sequence) FROM log_entries), 1),
        ${sequence?.lastValue ?? 1}, (SELECT last_value FROM log_entries_local_sequence_seq)),
      ${sequence?.called ?? false} OR EXISTS (SELECT 1 FROM log_entries)
        OR (SELECT is_called FROM log_entries_local_sequence_seq))`);
    await restoreEntries?.complete();
    await restoreStreams?.complete();
    await restoreSequence?.complete();
  };
};
