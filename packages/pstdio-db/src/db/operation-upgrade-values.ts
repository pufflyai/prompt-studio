import { isDeepStrictEqual } from "node:util";
import { sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import type { OperationReceipt } from "./schemas/storage-ordered-records";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/** Inspect only the incoming facts, never payloads or accumulated per-operation history.
 * Merge each bounded archive page in SQL; dependency epoch selection is restored after the document and operation archives. */
export const restoreOperationFacts = async (
  tx: Transaction,
  kind: "storage_ordered_touches" | "storage_ordered_receipts",
  inputs: Record<string, unknown>[],
) => {
  const input = JSON.stringify(inputs);
  if (kind === "storage_ordered_touches") {
    const { rows } = await tx.execute<{ expected: number | string; actual: number | string | null }>(sql`
      SELECT f.local_sequence AS expected,o.local_sequence AS actual
      FROM jsonb_to_recordset(${input}::jsonb) AS f(owner_id integer,operation_id text,local_sequence bigint)
      LEFT JOIN operations o ON o.owner_id=f.owner_id AND o.operation_id=f.operation_id`);
    for (const row of rows) {
      if (row.actual === null) throw new Error("Restored operation fact has no identity");
      if (Number(row.actual) !== Number(row.expected))
        throw new Error("Ordered storage restoration conflict: touch sequence");
    }
    await tx.execute(sql`UPDATE operations o SET touches=ARRAY(
      SELECT DISTINCT id FROM unnest(o.touches || f.touches) id)
      FROM (SELECT owner_id,operation_id,array_agg(record_id) AS touches
        FROM jsonb_to_recordset(${input}::jsonb) AS fact(owner_id integer,operation_id text,record_id text)
        GROUP BY owner_id,operation_id) f
      WHERE o.owner_id=f.owner_id AND o.operation_id=f.operation_id AND NOT o.touches @> f.touches`);
    return;
  }
  const { rows } = await tx.execute<{
    found: string | null;
    previous: OperationReceipt | null;
    state: "accepted" | "refused";
    admission_fingerprint: string;
    indexed: boolean;
  }>(sql`SELECT o.operation_id AS found,o.receipt->f.epoch AS previous,f.state,f.admission_fingerprint,f.indexed
    FROM jsonb_to_recordset(${input}::jsonb)
      AS f(owner_id integer,operation_id text,epoch text,state text,admission_fingerprint text,indexed boolean)
    LEFT JOIN operations o ON o.owner_id=f.owner_id AND o.operation_id=f.operation_id`);
  for (const row of rows) {
    if (row.found === null) throw new Error("Restored operation fact has no identity");
    const expected = { state: row.state, admissionFingerprint: row.admission_fingerprint, indexed: row.indexed };
    if (row.previous !== null && !isDeepStrictEqual(row.previous, expected))
      throw new Error("Ordered storage restoration conflict: receipt");
  }
  await tx.execute(sql`UPDATE operations o SET receipt=o.receipt || f.receipt,
    receipt_indexed=NOT EXISTS (SELECT 1 FROM jsonb_each(o.receipt || f.receipt) fact(key,value)
      WHERE fact.value->>'indexed'='false')
    FROM (SELECT owner_id,operation_id,jsonb_object_agg(epoch,jsonb_build_object(
      'state',state,'admissionFingerprint',admission_fingerprint,'indexed',indexed)) AS receipt
      FROM jsonb_to_recordset(${input}::jsonb)
        AS fact(owner_id integer,operation_id text,epoch text,state text,admission_fingerprint text,indexed boolean)
      GROUP BY owner_id,operation_id) f
    WHERE o.owner_id=f.owner_id AND o.operation_id=f.operation_id AND NOT o.receipt @> f.receipt`);
};
