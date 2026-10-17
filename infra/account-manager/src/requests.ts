import { and, eq, sql } from "drizzle-orm";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { requests } from "./schema";

export const executeRequest = async (
  db: ManagerDatabase,
  intent: { accountId: string; requestId: string },
  kind: string,
  body: Json,
  apply: (transaction: ManagerTransaction) => Promise<Record<string, Json>>,
) => {
  const digest = await fingerprint({ kind, body });
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock_shared(0, 0)`);
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(1, hashtext(${intent.accountId}))`);
    const where = and(eq(requests.accountId, intent.accountId), eq(requests.id, intent.requestId));
    const saved = (await transaction.select().from(requests).where(where))[0];
    if (saved) {
      if (saved.fingerprint !== digest) throw new Error("Manager request identity reused with changed intent");
      return { created: false, result: saved.result };
    }
    const result = await apply(transaction);
    await transaction
      .insert(requests)
      .values({ accountId: intent.accountId, id: intent.requestId, fingerprint: digest, result });
    return { created: true, result };
  });
};
