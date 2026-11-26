import { open } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import type { PGlite } from "@electric-sql/pglite";
import type { OrderedRecord } from "pstdio-sync/records";
import {
  canonicalRecordFromRow,
  orderedRecordMetadata,
  stableRecordColumns,
} from "../services/extension-storage/ordered-record-row";
import { encodeProjectionValue } from "../services/extension-storage/record-projection-codec";

// The ordinary migration can admit optimistic or unpaired representations independently.
export class NeedsRecordAdmission extends Error {}

interface ReleasedRecord {
  owner_id: number | null;
  record_id: string | null;
  state: string | null;
  deleted: boolean;
  revision: string;
  live: string | null;
  query_values: string;
  native_versions: string;
}

// PostgreSQL binary COPY prefixes every field with a signed length (-1 means SQL NULL).
// JSONB's wire representation is a version byte followed by UTF-8 JSON.
const jsonField = (text: string) => Buffer.from(`\x01${text}`);
const jsonValue = (v: unknown) => (v == null ? null : jsonField(JSON.stringify(v)));
const textField = (v: string | null) => (v == null ? null : Buffer.from(v));
function recordBytes(owner: number, deleted: boolean, id: string, rest: (Buffer | null)[]) {
  const key = Buffer.from(id);
  const fields = [key, ...rest];
  const size = 2 + (fields.length + 2) * 4 + 5 + fields.reduce((n, f) => n + (f?.length ?? 0), 0);
  const out = Buffer.allocUnsafe(size);
  let i = out.writeInt16BE(fields.length + 2);
  i = out.writeInt32BE(4, i);
  i = out.writeInt32BE(owner, i);
  i = out.writeInt32BE(key.length, i);
  i += key.copy(out, i);
  i = out.writeInt32BE(1, i);
  i = out.writeUInt8(Number(deleted), i);
  for (const f of rest) {
    i = out.writeInt32BE(f?.length ?? -1, i);
    if (f) i += f.copy(out, i);
  }
  return out;
}

function currentRow(input: ReleasedRecord) {
  if (input.owner_id === null || input.record_id === null || input.state === null)
    throw new NeedsRecordAdmission("Released record has only one representation");
  const canonical: OrderedRecord = JSON.parse(input.state);
  if (canonical.recordId !== input.record_id || canonical.deleted !== input.deleted)
    throw new NeedsRecordAdmission("Released record identity or deletion state differs");

  const columns = canonical.deleted ? stableRecordColumns(canonical) : JSON.parse(input.live!);
  if (!canonical.deleted) {
    columns.native_sources = encodeProjectionValue(columns.native_sources);
    columns.meta = orderedRecordMetadata(canonical);
  }
  const stored = { ...columns, deleted: input.deleted, record_id: input.record_id, base: null };
  if (!isDeepStrictEqual(canonicalRecordFromRow(stored), canonical))
    throw new NeedsRecordAdmission("Released record has an outstanding projection");
  return recordBytes(input.owner_id, input.deleted, input.record_id, [
    jsonValue(columns.value),
    jsonField(input.query_values),
    jsonValue(columns.asset),
    jsonValue(columns.shared),
    jsonValue(columns.native_sources),
    jsonField(input.native_versions),
    textField(columns.record_lifetime),
    textField(input.revision),
    jsonValue(columns.meta),
  ]);
}

export async function exportSettledRecords(source: PGlite, file: string, signal?: AbortSignal) {
  const output = await open(file, "wx", 0o600);
  try {
    await output.writeFile(Buffer.from("5047434f50590aff0d0a000000000000000000", "hex"));
    await source.transaction(async (tx) => {
      await tx.exec(`DECLARE export_records NO SCROLL CURSOR FOR
        SELECT o.id AS owner_id, c.record_id, convert_from(r.state,'UTF8') AS state, c.deleted, c.revision,
          c.query_values::text,c.native_versions::text,
          CASE WHEN NOT c.deleted THEN json_build_object('value',c.value,'asset',c.asset,'shared',c.shared,
            'native_sources',c.native_sources,'record_lifetime',c.record_lifetime)::text END AS live
        FROM storage_current_records c FULL JOIN storage_ordered_records r USING(workbench_id,extension_id,record_id)
        LEFT JOIN pg_temp.reimport_owners o ON o.project_id=c.workbench_id AND o.extension_id=c.extension_id`);
      for (;;) {
        signal?.throwIfAborted();
        const { rows } = await tx.query<ReleasedRecord>("FETCH FORWARD 256 FROM export_records");
        if (!rows.length) break;
        await output.writeFile(Buffer.concat(rows.map(currentRow)));
      }
    });
    await output.writeFile(Buffer.from([255, 255]));
    await output.sync();
  } finally {
    await output.close();
  }
}
