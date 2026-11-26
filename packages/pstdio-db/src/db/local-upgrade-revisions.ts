import { sql } from "drizzle-orm";
import type { OrderedTransaction } from "../services/extension-storage/ordered-sql";

/** Released ordered observations embed the save ancestry of every field in the public read token. */
export function localRevision(revision: string) {
  if (!revision.startsWith("{") || !revision.includes('"stamps"') || revision.endsWith('"stamps":{}}')) return revision;
  let observed: { version?: number; stamps?: unknown } | null;
  try {
    observed = JSON.parse(revision);
  } catch {
    // Earlier extensions could save opaque revision strings.
    return revision;
  }
  if (observed?.version !== 1 || !observed.stamps || typeof observed.stamps !== "object") return revision;
  return JSON.stringify({ ...observed, stamps: {} });
}

export async function resetReleasedRevisions(tx: OrderedTransaction) {
  let owner = 0;
  let id = "";
  for (;;) {
    const { rows } = await tx.execute<{ owner_id: number; record_id: string; revision: string }>(sql`
      SELECT owner_id,record_id,revision FROM records WHERE (owner_id,record_id)>(${owner},${id})
      AND revision LIKE '{%"stamps"%' AND revision NOT LIKE '%"stamps":{}}' ORDER BY owner_id,record_id LIMIT 128`);
    if (!rows.length) return;
    const changed = rows.flatMap((row) => {
      const revision = localRevision(row.revision);
      return revision === row.revision ? [] : [{ ...row, revision }];
    });
    if (changed.length)
      await tx.execute(sql`UPDATE records r SET revision=v.revision FROM
      jsonb_to_recordset(${JSON.stringify(changed)}::jsonb) v(owner_id int,record_id text,revision text)
      WHERE (r.owner_id,r.record_id)=(v.owner_id,v.record_id)`);
    const last = rows.at(-1)!;
    owner = last.owner_id;
    id = last.record_id;
  }
}
