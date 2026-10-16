import { and, eq, gt, sql } from "drizzle-orm";
import { digestCredential } from "./credential";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { accounts, ownerSessions } from "./schema";
import { lockAccount, withManagerTransaction } from "./transactions";

export const authorizeSession = async (db: Pick<ManagerDatabase, "select">, token: string) =>
  (
    await db
      .select({ accountId: ownerSessions.accountId })
      .from(ownerSessions)
      .innerJoin(accounts, eq(accounts.id, ownerSessions.accountId))
      .where(
        and(
          eq(ownerSessions.digest, digestCredential(token)),
          gt(ownerSessions.expiresAt, sql`clock_timestamp()`),
          eq(accounts.state, "active"),
        ),
      )
  )[0] ?? null;

export const withOwnerSession = <T>(
  db: ManagerDatabase,
  token: string,
  apply: (transaction: ManagerTransaction, accountId: string) => Promise<T>,
) =>
  withManagerTransaction(db, async (transaction) => {
    const row = (
      await transaction
        .select({ accountId: ownerSessions.accountId })
        .from(ownerSessions)
        .where(eq(ownerSessions.digest, digestCredential(token)))
    )[0];
    if (!row) throw new Error("Owner session is unavailable");
    await lockAccount(transaction, row.accountId);
    const authority = await authorizeSession(transaction, token);
    if (!authority) throw new Error("Owner session is unavailable");
    return apply(transaction, authority.accountId);
  });
