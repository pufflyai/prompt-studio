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
    let queryTime=0,rowTime=0,writeTime=0,batches=0;
    await source.transaction(async (tx) => {
      const owners=(await tx.query('SELECT project_id,extension_id,id FROM reimport_owners')).rows;
      const byProject=new Map<string,Map<string,number>>();
      for (const o of owners){let group=byProject.get(o.project_id);if(!group)byProject.set(o.project_id,group=new Map);group.set(o.extension_id,o.id);}
      await tx.exec(`SET LOCAL work_mem='96MB'; SET LOCAL enable_indexscan=off; SET LOCAL enable_indexonlyscan=off;
        DECLARE export_records NO SCROLL CURSOR FOR
        SELECT c.workbench_id,c.extension_id,c.record_id,c.deleted,c.revision,c.query_values::text,c.native_versions::text,
          CASE WHEN NOT c.deleted THEN json_build_object('value',c.value,'asset',c.asset,'shared',c.shared,
            'native_sources',c.native_sources,'record_lifetime',c.record_lifetime)::text END AS live
        FROM storage_current_records c;
        DECLARE export_state NO SCROLL CURSOR FOR SELECT workbench_id,extension_id,record_id,convert_from(state,'UTF8') AS state
        FROM storage_ordered_records`);
      const left=new Map<string,any>(),right=new Map<string,any>();let peak=0;
      for (;;) {
        const a=performance.now();
        const [l,r]=await tx.exec('FETCH FORWARD 512 FROM export_records; FETCH FORWARD 512 FROM export_state');
        const b=performance.now();queryTime+=b-a;
        if(!l.rows.length&&!r.rows.length)break;
        const outputRows:Buffer[]=[];
        function consume(rows: any[], projections:boolean){
          const other=projections?right:left, active=projections?left:right;
          for(const row of rows){
            row.owner_id=byProject.get(row.workbench_id)?.get(row.extension_id)??null;
            if(row.owner_id===null)throw new NeedsRecordAdmission("missing owner");
            const key=row.owner_id+"\0"+row.record_id, found=other.get(key);
            if(!found){active.set(key,row);continue;}
            other.delete(key);const c=projections?row:found;c.state=projections?found.state:row.state;outputRows.push(currentRow(c));
          }
        }
        consume(l.rows,true);consume(r.rows,false);peak=Math.max(peak,left.size+right.size);
        if(left.size+right.size>8192)throw Error('window');
        const data=Buffer.concat(outputRows);const c=performance.now();rowTime+=c-b;await output.writeFile(data);writeTime+=performance.now()-c;batches++;
      }
      if(left.size||right.size)throw new NeedsRecordAdmission('Unpaired records');
      
    });
    await output.writeFile(Buffer.from([255, 255]));
    await output.sync();
  } finally {
    await output.close();
  }
}
