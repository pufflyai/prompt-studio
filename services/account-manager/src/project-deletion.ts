import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { ProjectDeletionAcknowledgement, ProjectDeletionStatus } from "pstdio-sync-contracts";
import { requireRelay } from "./account-features";
import type { WorkbenchInput } from "./contracts";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { projectDeletions, spaceKeys, workbenches } from "./schema";
import { withAccountTransaction } from "./transactions";

type Deletion = typeof projectDeletions.$inferSelect;
const status = (row: Deletion): ProjectDeletionStatus => ({
  workbenchId: row.workbenchId,
  operationId: row.operationId,
  startedAt: row.startedAt.toISOString(),
  state: row.state,
  completedAt: row.completedAt?.toISOString() ?? null,
});

const scope = (input: WorkbenchInput) =>
  and(eq(projectDeletions.accountId, input.accountId), eq(projectDeletions.workbenchId, input.workbenchId));

const find = async (transaction: ManagerTransaction, input: WorkbenchInput, requestedBy?: string) => {
  const [row] = await transaction
    .select()
    .from(projectDeletions)
    .where(and(scope(input), requestedBy === undefined ? undefined : eq(projectDeletions.requestedBy, requestedBy)));
  return row;
};

export class ProjectRetired extends Error {
  constructor() {
    super("This cloud project identity has been permanently retired");
  }
}

export const assertProjectCanSync = async (transaction: ManagerTransaction, input: WorkbenchInput) => {
  if (await find(transaction, input)) throw new ProjectRetired();
};

export const readProjectDeletion = async (
  transaction: ManagerTransaction,
  input: WorkbenchInput,
  requestedBy?: string,
) => {
  const row = await find(transaction, input, requestedBy);
  return row ? status(row) : null;
};

export const listOutstandingProjectDeletions = async (
  transaction: ManagerTransaction,
  accountId: string,
  requestedBy?: string,
) => {
  const rows = await transaction
    .select()
    .from(projectDeletions)
    .where(
      and(
        eq(projectDeletions.accountId, accountId),
        ne(projectDeletions.state, "completed"),
        requestedBy === undefined ? undefined : eq(projectDeletions.requestedBy, requestedBy),
      ),
    )
    .orderBy(asc(projectDeletions.startedAt), asc(projectDeletions.operationId));
  return rows.map(status);
};

export const startProjectDeletion = async (
  transaction: ManagerTransaction,
  input: WorkbenchInput,
  requestedBy?: string,
) => {
  const existing = await find(transaction, input);
  if (existing?.state === "needs-attention") {
    const [retry] = await transaction
      .update(projectDeletions)
      .set({ state: "deleting", delivery: existing.delivery + 1 })
      .where(scope(input))
      .returning();
    return status(retry);
  }
  if (existing) return status(existing);

  await requireRelay(transaction, input.accountId);
  // Membership is the single gate for discovery, access renewal and issuance of space keys.
  const removed = await transaction
    .delete(workbenches)
    .where(and(eq(workbenches.accountId, input.accountId), eq(workbenches.id, input.workbenchId)))
    .returning({ id: workbenches.id });
  if (!removed.length) return null;
  const [row] = await transaction
    .insert(projectDeletions)
    .values({ ...input, requestedBy, operationId: crypto.randomUUID(), state: "deleting" })
    .returning();
  return status(row);
};

export const listProjectDeletionJobs = (db: ManagerDatabase) =>
  db
    .select({
      accountId: projectDeletions.accountId,
      workbenchId: projectDeletions.workbenchId,
      operationId: projectDeletions.operationId,
      delivery: projectDeletions.delivery,
    })
    .from(projectDeletions)
    .where(sql`${projectDeletions.state} = 'deleting'`)
    .orderBy(asc(projectDeletions.startedAt), asc(projectDeletions.operationId))
    .limit(50);

export const acknowledgeProjectDeletion = (db: ManagerDatabase, input: ProjectDeletionAcknowledgement) =>
  withAccountTransaction(db, input.accountId, async (transaction) => {
    const existing = await find(transaction, input);
    if (!existing || existing.operationId !== input.operationId) return null;
    if (existing.state === "completed") return status(existing);
    if (input.result === "needs-attention") {
      if (existing.delivery !== input.delivery) return status(existing);
      const [changed] = await transaction
        .update(projectDeletions)
        .set({ state: "needs-attention" })
        .where(scope(input))
        .returning();
      return status(changed);
    }
    await transaction
      .delete(spaceKeys)
      .where(and(eq(spaceKeys.accountId, input.accountId), eq(spaceKeys.workbenchId, input.workbenchId)));
    const [changed] = await transaction
      .update(projectDeletions)
      .set({ state: "completed", completedAt: sql`clock_timestamp()` })
      .where(scope(input))
      .returning();
    return status(changed);
  });
