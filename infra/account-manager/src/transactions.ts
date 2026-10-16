import { sql } from "drizzle-orm";
import type { ManagerDatabase, ManagerTransaction } from "./database";

export const withManagerTransaction = <T>(
  db: ManagerDatabase,
  apply: (transaction: ManagerTransaction) => Promise<T>,
) =>
  db.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock_shared(0, 0)`);
    return apply(transaction);
  });

export const withAccountTransaction = <T>(
  db: ManagerDatabase,
  accountId: string,
  apply: (transaction: ManagerTransaction) => Promise<T>,
) =>
  withManagerTransaction(db, async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(1, hashtext(${accountId}))`);
    return apply(transaction);
  });
