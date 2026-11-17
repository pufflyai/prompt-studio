import { asc, eq, sql } from "drizzle-orm";
import { readAccountFeatures } from "./account-features";
import type { ManagerDatabase } from "./database";
import { accounts, devices, spaceKeys, workbenches } from "./schema";

/**
 * What the manager knows about one account, for an operator: its state and features, every device
 * including removed ones, and every project that syncs now or ever held keys. Keys outlive a project's
 * removal, so the list also names projects a person made local again. No
 * credential digest, signing key or space secret leaves this function.
 */
export const inspectManagerAccount = async (db: ManagerDatabase, accountId: string) => {
  const [account] = await db.select({ state: accounts.state }).from(accounts).where(eq(accounts.id, accountId));
  if (!account) throw new Error(`No account ${accountId}`);
  const deviceRows = await db
    .select({
      id: devices.id,
      name: devices.name,
      platform: devices.platform,
      createdAt: devices.createdAt,
      lastSeenAt: devices.lastSeenAt,
      removedAt: devices.removedAt,
    })
    .from(devices)
    .where(eq(devices.accountId, accountId))
    .orderBy(asc(devices.createdAt), asc(devices.id));
  const syncing = await db
    .select({ id: workbenches.id })
    .from(workbenches)
    .where(eq(workbenches.accountId, accountId))
    .orderBy(asc(workbenches.id));
  const keyed = await db
    .select({ id: spaceKeys.workbenchId, generations: sql<number>`max(${spaceKeys.generation})`.mapWith(Number) })
    .from(spaceKeys)
    .where(eq(spaceKeys.accountId, accountId))
    .groupBy(spaceKeys.workbenchId)
    .orderBy(asc(spaceKeys.workbenchId));
  const current = new Set(syncing.map((row) => row.id));
  return {
    accountId,
    state: account.state,
    features: await readAccountFeatures(db, accountId),
    devices: deviceRows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      removedAt: row.removedAt?.toISOString() ?? null,
    })),
    // Keys are created on a device's first request, so a syncing project may have none yet.
    projects: [...new Set([...current, ...keyed.map((row) => row.id)])].sort().map((projectId) => ({
      projectId,
      syncing: current.has(projectId),
      keyGenerations: keyed.find((row) => row.id === projectId)?.generations ?? 0,
    })),
  };
};
