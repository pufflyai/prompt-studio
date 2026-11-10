import { and, eq, sql } from "drizzle-orm";
import type { ManagerDatabase } from "./database";
import { spaceKeys, workbenches } from "./schema";
import { withAccountTransaction } from "./transactions";

/**
 * Removes one project's encryption keys, for an operator clearing the project from Cloud. Without
 * `execute` it only reports them. When the project syncs again, its first key request creates new keys,
 * so nothing sealed before can be read with them.
 *
 * It refuses while the project is registered: devices would still sync it, and a project's relay
 * access needs that registration, so an unregistered project has no device writing to the relay.
 */
export const clearManagerProject = (
  db: ManagerDatabase,
  input: { accountId: string; projectId: string; execute: boolean },
) =>
  withAccountTransaction(db, input.accountId, async (transaction) => {
    const project = and(eq(spaceKeys.accountId, input.accountId), eq(spaceKeys.workbenchId, input.projectId));
    const [registered] = await transaction
      .select({ id: workbenches.id })
      .from(workbenches)
      .where(and(eq(workbenches.accountId, input.accountId), eq(workbenches.id, input.projectId)));
    const keys = await transaction
      .select({ space: spaceKeys.space, generations: sql<number>`count(*)`.mapWith(Number) })
      .from(spaceKeys)
      .where(project)
      .groupBy(spaceKeys.space)
      .orderBy(spaceKeys.space);
    const report = { accountId: input.accountId, projectId: input.projectId, syncing: Boolean(registered), keys };
    if (!input.execute) return { ...report, executed: false };
    if (registered) throw new Error("The project still syncs. Make it local on every device, then clear it again.");
    await transaction.delete(spaceKeys).where(project);
    return { ...report, executed: true };
  });
