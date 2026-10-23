import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { storage_document_updates, storage_documents } from "../../db/schemas.pg";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export const resourceDocumentId = (recordId: string) => JSON.stringify(["resource", recordId]);

export const loadResourceDocuments = async (tx: Transaction, owner: StorageOwner, ids: string[]) => {
  const scope = (table: typeof storage_documents | typeof storage_document_updates) =>
    and(
      eq(table.workbench_id, owner.workbenchId),
      eq(table.extension_id, owner.extensionId),
      inArray(table.document_id, ids),
    );
  const documents = await tx.select().from(storage_documents).where(scope(storage_documents));
  const updates = await tx
    .select()
    .from(storage_document_updates)
    .where(scope(storage_document_updates))
    .orderBy(asc(storage_document_updates.document_id), asc(storage_document_updates.revision));
  const sources = new Map(documents.map((row) => [row.document_id, { ...row, states: [row.state] }]));
  // A resource row stores its checkpoint revision; the update tail holds the current head.
  for (const row of updates) {
    const source = sources.get(row.document_id)!;
    source.states.push(row.update);
    source.revision = Math.max(source.revision, row.revision);
  }
  return {
    sources,
    loaded: {
      documents: documents.length,
      updates: updates.length,
      bytes:
        documents.reduce((sum, row) => sum + row.state.byteLength, 0) +
        updates.reduce((sum, row) => sum + row.update.byteLength, 0),
    },
  };
};

interface ResourceChange {
  id: string;
  revision: number;
  foldedRevision: number;
  checkpoint: Uint8Array | null;
  update: Uint8Array | null;
}

export const persistResourceDocuments = async (tx: Transaction, owner: StorageOwner, prepared: ResourceChange[]) => {
  const changed = prepared.filter((row) => row.update !== null);
  if (!changed.length) return;
  const checkpoints = changed.filter((row) => row.checkpoint);
  const rows = checkpoints.map((row) => ({
    id: row.id,
    revision: row.revision,
    state: Buffer.from(row.checkpoint!).toString("hex"),
  }));
  if (rows.length)
    await tx.execute(sql`
    INSERT INTO storage_documents (workbench_id, extension_id, document_id, state, revision, folded_revision)
    SELECT ${owner.workbenchId}, ${owner.extensionId}, input.id, decode(input.state, 'hex'), input.revision, input.revision
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS input(id text, state text, revision bigint)
    ON CONFLICT (workbench_id, extension_id, document_id) DO UPDATE
    SET state = excluded.state, revision = excluded.revision, folded_revision = excluded.folded_revision
  `);
  const ordinary = changed.filter((row) => !row.checkpoint);
  const tails = ordinary.map((row) => ({
    id: row.id,
    revision: row.revision,
    update: Buffer.from(row.update!).toString("hex"),
  }));
  if (tails.length)
    await tx.execute(sql`
    INSERT INTO storage_document_updates (workbench_id, extension_id, document_id, revision, "update")
    SELECT ${owner.workbenchId}, ${owner.extensionId}, input.id, input.revision, decode(input."update", 'hex')
    FROM jsonb_to_recordset(${JSON.stringify(tails)}::jsonb) AS input(id text, revision bigint, "update" text)
  `);
  const folded = checkpoints
    .filter((row) => row.foldedRevision > 0)
    .map((row) => ({ id: row.id, revision: row.revision }));
  if (folded.length)
    // Restrict indexed candidates before joining cutoffs; owner-wide estimates can hide a full-tail scan.
    await tx.execute(sql`
    DELETE FROM storage_document_updates AS saved
    USING jsonb_to_recordset(${JSON.stringify(folded)}::jsonb) AS input(id text, revision bigint)
    WHERE saved.workbench_id = ${owner.workbenchId} AND saved.extension_id = ${owner.extensionId}
      AND saved.document_id IN (${sql.join(
        folded.map((row) => sql`${row.id}`),
        sql`, `,
      )})
      AND saved.document_id = input.id AND saved.revision <= input.revision
  `);
};
