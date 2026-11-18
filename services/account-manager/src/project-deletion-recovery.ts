import { and, asc, eq, exists, sql } from "drizzle-orm";
import { canonicalJson, identitySchema, projectDeletionStatusSchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { ManagerTransaction } from "./database";
import { projectDeletions, spaceKeys, workbenches } from "./schema";

export const deletionReceiptSchema = projectDeletionStatusSchema
  .extend({ accountId: identitySchema, delivery: z.int().positive() })
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
    if (scopes.has(scope)) invalid(["deletions", index], "Duplicate project deletion");
    scopes.add(scope);
  }
};

export const captureProjectDeletionReceipts = async (tx: ManagerTransaction) => {
  const rows = await tx
    .select()
    .from(projectDeletions)
    .orderBy(asc(projectDeletions.accountId), asc(projectDeletions.workbenchId));
  return rows.map((row) => ({
    ...row,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }));
};

export const restoreProjectDeletionReceipts = async (tx: ManagerTransaction, receipts: Receipt[]) => {
  const known = await captureProjectDeletionReceipts(tx);
  const operations = new Map(known.map((row) => [projectScope(row.accountId, row.workbenchId), row.operationId]));
  for (const row of receipts) {
    const scope = projectScope(row.accountId, row.workbenchId);
    const current = operations.get(scope);
    if (current && current !== row.operationId) throw new Error("Manager snapshot conflicts with a deletion operation");
    operations.set(scope, row.operationId);
  }
  const batchSize = 1_000;
  for (let offset = 0; offset < receipts.length; offset += batchSize) {
    await tx
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
          state: "completed",
          completedAt: sql`excluded."completedAt"`,
          delivery: sql`greatest(excluded.delivery, ${projectDeletions.delivery})`,
        },
        setWhere: sql`excluded.state = 'completed' AND ${projectDeletions.state} <> 'completed'`,
      });
  }
  // An imported receipt is authoritative over both existing content authority and older snapshot rows.
  if (operations.size > 0) {
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
  return operations;
};
