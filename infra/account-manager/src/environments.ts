import { eq } from "drizzle-orm";
import type { ManagerDatabase } from "./database";
import { credentials } from "./schema";

export const listEnvironments = async (db: Pick<ManagerDatabase, "select">, accountId: string) => {
  const rows = await db
    .select({
      id: credentials.id,
      accountId: credentials.accountId,
      environmentId: credentials.environmentId,
      workbenchId: credentials.workbenchId,
      expiresAt: credentials.expiresAt,
      revokedAt: credentials.revokedAt,
    })
    .from(credentials)
    .where(eq(credentials.accountId, accountId));
  return rows.map((row) => ({
    ...row,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }));
};
