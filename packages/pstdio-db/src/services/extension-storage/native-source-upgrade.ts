import { and, asc, eq, sql } from "drizzle-orm";
import { recordLifetime } from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { storage_current_records as records } from "../../db/schemas.pg";
import { loadResourceDocuments, resourceDocumentId } from "./resource-document-persistence";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Row = { workbenchId: string; extensionId: string; recordId: string };
const readLifetimes = async (tx: Transaction, rows: Row[]) => {
  const owners = new Map<string, Row[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.workbenchId, row.extensionId]);
    const group = owners.get(key) ?? [];
    group.push(row);
    owners.set(key, group);
  }
  const facts: (Row & { lifetime: string })[] = [];
  for (const group of owners.values()) {
    const { sources } = await loadResourceDocuments(
      tx,
      group[0]!,
      group.map((row) => resourceDocumentId(row.recordId)),
    );
    for (const row of group) {
      const saved = sources.get(resourceDocumentId(row.recordId));
      if (!saved) throw new Error("A saved record is missing its source history");
      const document = new Y.Doc();
      try {
        for (const update of saved.states) Y.applyUpdate(document, update);
        const lifetime = recordLifetime(document, row.recordId);
        if (!lifetime) throw new Error("A live record is missing its causal identity");
        facts.push({ ...row, lifetime });
      } finally {
        document.destroy();
      }
    }
  }
  return facts;
};
const writeLifetimes = async (tx: Transaction, facts: Awaited<ReturnType<typeof readLifetimes>>) => {
  if (!facts.length) return;
  await tx.execute(sql`
    UPDATE storage_current_records AS saved SET record_lifetime = source.lifetime
    FROM jsonb_to_recordset(${JSON.stringify(facts)}::jsonb)
      AS source("workbenchId" text, "extensionId" text, "recordId" text, lifetime text)
    WHERE (saved.workbench_id, saved.extension_id, saved.record_id) IN (${sql.join(
      facts.map((fact) => sql`(${fact.workbenchId}, ${fact.extensionId}, ${fact.recordId})`),
      sql`, `,
    )})
      AND saved.workbench_id = source."workbenchId" AND saved.extension_id = source."extensionId" AND saved.record_id = source."recordId"
  `);
};
/** Backfill derived causal identities once at startup; foreground binding reads only indexed metadata. */
export const upgradeNativeSourceLifetimes = async (db: DbClient) => {
  let cursor: string[] | undefined;
  while (true) {
    const rows = await db.transaction(async (tx) => {
      const rows = await tx
        .select({ workbenchId: records.workbench_id, extensionId: records.extension_id, recordId: records.record_id })
        .from(records)
        .where(
          and(
            eq(records.deleted, false),
            eq(records.record_lifetime, ""),
            cursor
              ? sql`(${records.workbench_id}, ${records.extension_id}, ${records.record_id}) > (${cursor[0]}, ${cursor[1]}, ${cursor[2]})`
              : undefined,
          ),
        )
        .orderBy(asc(records.workbench_id), asc(records.extension_id), asc(records.record_id))
        .limit(500);
      await writeLifetimes(tx, await readLifetimes(tx, rows));
      return rows;
    });
    if (rows.length < 500) return;
    const last = rows.at(-1)!;
    cursor = [last.workbenchId, last.extensionId, last.recordId];
  }
};
