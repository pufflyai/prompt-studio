import { and, asc, eq, gt, isNotNull, or, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { native_document_file_projections as projections, storage_documents } from "../../db/schemas.pg";

interface Address {
  owner: StorageOwner;
  documentKey: string;
  projectionKey?: string;
}
const columns = ({ owner, documentKey, projectionKey = "handler" }: Address) => ({
  workbench_id: owner.workbenchId,
  extension_id: owner.extensionId,
  document_key: documentKey,
  projection_key: projectionKey,
});
const where = (input: Address) => {
  const address = columns(input);
  return and(
    eq(projections.workbench_id, address.workbench_id),
    eq(projections.extension_id, address.extension_id),
    eq(projections.document_key, address.document_key),
    eq(projections.projection_key, address.projection_key),
  );
};

export const createNativeFileProjectionsDBService = (db: DbClient) => ({
  async initialize(input: Address & { state: Uint8Array | null }) {
    await db
      .insert(projections)
      .values({ ...columns(input), baseline: input.state })
      .onConflictDoNothing();
  },
  async read(input: Address) {
    const [row] = await db
      .select({
        baseline: projections.baseline,
        pending: projections.pending,
        completedRevision: projections.completed_revision,
      })
      .from(projections)
      .where(where(input));
    return row;
  },
  async baseline(input: Address & { state: Uint8Array }) {
    await db.update(projections).set({ baseline: input.state }).where(where(input));
  },
  async begin(input: Address & { state: Uint8Array }) {
    await db.update(projections).set({ pending: input.state }).where(where(input));
  },
  async complete(input: Address & { state: Uint8Array; revision?: number }) {
    const rows = await db
      .update(projections)
      .set({
        baseline: input.state,
        pending: null,
        ...(input.revision !== undefined && { completed_revision: input.revision }),
      })
      .where(and(where(input), eq(projections.pending, input.state)))
      .returning({ key: projections.document_key });
    return rows.length > 0;
  },
  async cancel(input: Address & { state: Uint8Array }) {
    await db
      .update(projections)
      .set({ pending: null })
      .where(and(where(input), eq(projections.pending, input.state)));
  },
  async *pending() {
    let cursor: string[] | undefined;
    while (true) {
      const rows = await db
        .select({
          workbenchId: projections.workbench_id,
          extensionId: projections.extension_id,
          documentKey: projections.document_key,
        })
        .from(projections)
        .leftJoin(
          storage_documents,
          and(
            eq(storage_documents.workbench_id, projections.workbench_id),
            eq(storage_documents.extension_id, projections.extension_id),
            eq(storage_documents.document_id, sql`'["native-markdown","' || ${projections.document_key} || '"]'`),
          ),
        )
        .where(
          and(
            or(isNotNull(projections.pending), gt(storage_documents.revision, projections.completed_revision)),
            eq(projections.projection_key, "handler"),
            cursor
              ? sql`(${projections.workbench_id}, ${projections.extension_id}, ${projections.document_key}) > (${cursor[0]}, ${cursor[1]}, ${cursor[2]})`
              : undefined,
          ),
        )
        .orderBy(asc(projections.workbench_id), asc(projections.extension_id), asc(projections.document_key))
        .limit(100);
      for (const { workbenchId, extensionId, documentKey } of rows)
        yield { owner: { workbenchId, extensionId }, documentKey };
      if (rows.length < 100) return;
      const last = rows.at(-1)!;
      cursor = [last.workbenchId, last.extensionId, last.documentKey];
    }
  },
});
