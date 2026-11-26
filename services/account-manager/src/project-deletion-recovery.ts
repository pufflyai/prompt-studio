import { and, asc, eq, exists, sql } from "drizzle-orm";
import { canonicalJson, identitySchema, projectDeletionStatusSchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { ManagerTransaction } from "./database";
import { projectDeletions, spaceKeys, workbenches } from "./schema";

export const deletionReceiptSchema = projectDeletionStatusSchema
  .extend({ accountId: identitySchema, delivery: z.int().positive(), requestedBy: identitySchema.optional() })
  .refine((row) => (row.state === "completed") === (row.completedAt !== null), {
    path: ["completedAt"],
    message: "Only a completed deletion has a completion time",
  });

type Receipt = z.infer<typeof deletionReceiptSchema>;
export const projectScope = (accountId: string, workbenchId: string) => canonicalJson([accountId, workbenchId]);

export const validateDeletionReceipts = (
  receipts: Receipt[],
  accountIds: ReadonlySet<string>,
  invalid: (path: (string | number)[], message: string) => void,
) => {
  const scopes = new Set<string>();
  for (const [index, row] of receipts.entries()) {
    const scope = projectScope(row.accountId, row.workbenchId);
    if (!accountIds.has(row.accountId)) invalid(["deletions", index], "Unknown deletion account");
    if (row.requestedBy !== undefined && !accountIds.has(row.requestedBy))
      invalid(["deletions", index, "requestedBy"], "Unknown deletion requester");
    if (scopes.has(scope)) invalid(["deletions", index], "Duplicate project deletion");
    scopes.add(scope);
  }
};

export const captureProjectDeletionReceipts = async (tx: ManagerTransaction) => {
  const rows = await tx
    .select()
    .from(projectDeletions)
    .orderBy(asc(projectDeletions.accountId), asc(projectDeletions.workbenchId));
  return rows.map(({ requestedBy, ...row }) => ({
    ...row,
    ...(requestedBy && { requestedBy }),
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }));
};

export const restoreProjectDeletionReceipts = async (tx: ManagerTransaction, receipts: Receipt[]) => {
  const fields = {
    accountId: projectDeletions.accountId,
    workbenchId: projectDeletions.workbenchId,
    operationId: projectDeletions.operationId,
    state: projectDeletions.state,
    requestedBy: projectDeletions.requestedBy,
  };
  const known = await tx.select(fields).from(projectDeletions);
  const retired = new Map(known.map((row) => [projectScope(row.accountId, row.workbenchId), row]));
  for (const row of receipts) {
    const current = retired.get(projectScope(row.accountId, row.workbenchId));
    if (current && current.operationId !== row.operationId)
      throw new Error("Manager snapshot conflicts with a deletion operation");
    if (current?.requestedBy && row.requestedBy && current.requestedBy !== row.requestedBy)
      throw new Error("Manager snapshot conflicts with a deletion requester");
  }
  const advances = sql`${projectDeletions.state} <> 'completed' AND (
    excluded.state = 'completed'
    OR excluded.delivery > ${projectDeletions.delivery}
    OR (excluded.delivery = ${projectDeletions.delivery}
      AND excluded.state = 'needs-attention' AND ${projectDeletions.state} = 'deleting')
  )`;
  const batchSize = 1_000;
  for (let offset = 0; offset < receipts.length; offset += batchSize) {
    const changed = await tx
      .insert(projectDeletions)
      .values(
        receipts.slice(offset, offset + batchSize).map((row) => ({
          ...row,
          startedAt: new Date(row.startedAt),
          completedAt: row.completedAt ? new Date(row.completedAt) : null,
        })),
      )
      .onConflictDoUpdate({
        target: [projectDeletions.accountId, projectDeletions.workbenchId],
        set: {
          state: sql`case when ${advances} then excluded.state else ${projectDeletions.state} end`,
          completedAt: sql`case when ${advances} then excluded."completedAt" else ${projectDeletions.completedAt} end`,
          delivery: sql`case when ${advances} then greatest(excluded.delivery, ${projectDeletions.delivery}) else ${projectDeletions.delivery} end`,
          requestedBy: sql`coalesce(${projectDeletions.requestedBy}, excluded."requestedBy")`,
        },
        // Requester recovery is independent of monotonic deletion progress, including completed receipts.
        setWhere: sql`${advances} OR (${projectDeletions.requestedBy} IS NULL AND excluded."requestedBy" IS NOT NULL)`,
      })
      .returning(fields);
    for (const row of changed) retired.set(projectScope(row.accountId, row.workbenchId), row);
  }
  // An imported receipt is authoritative over both existing content authority and older snapshot rows.
  if (retired.size > 0) {
    await tx.delete(workbenches).where(
      exists(
        tx
          .select()
          .from(projectDeletions)
          .where(
            and(
              eq(projectDeletions.accountId, workbenches.accountId),
              eq(projectDeletions.workbenchId, workbenches.id),
            ),
          ),
      ),
    );
    await tx.delete(spaceKeys).where(
      exists(
        tx
          .select()
          .from(projectDeletions)
          .where(
            and(
              eq(projectDeletions.accountId, spaceKeys.accountId),
              eq(projectDeletions.workbenchId, spaceKeys.workbenchId),
              eq(projectDeletions.state, "completed"),
            ),
          ),
      ),
    );
  }
  return retired;
};
