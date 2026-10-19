import { and, eq } from "drizzle-orm";
import { account } from "./auth-schema";
import { digestCredential } from "./credential";
import type { ManagerDatabase } from "./database";
import { accounts } from "./schema";
import { withAccountTransaction } from "./transactions";

export const createOwnerAccounts = (
  db: ManagerDatabase,
  readSession: (headers: Headers) => Promise<{ user: { id: string } } | null>,
) => {
  const subject = async (headers: Headers) => {
    const session = await readSession(headers);
    if (!session) throw new Error("Owner session unavailable");
    const [provider] = await db
      .select({ subject: account.accountId })
      .from(account)
      .where(and(eq(account.userId, session.user.id), eq(account.providerId, "google")));
    if (!provider) throw new Error("Google identity unavailable");
    return provider.subject;
  };
  return {
    async list(headers: Headers) {
      const ownerSubject = await subject(headers);
      return db
        .select({ accountId: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.ownerIssuer, "https://accounts.google.com"),
            eq(accounts.ownerSubject, ownerSubject),
            eq(accounts.state, "active"),
          ),
        );
    },
    async create(headers: Headers) {
      const ownerSubject = await subject(headers);
      // The provider identity determines the signup identity, including after a lost response.
      const accountId = digestCredential(`https://accounts.google.com\n${ownerSubject}`);
      return withAccountTransaction(db, accountId, async (transaction) => {
        await transaction
          .insert(accounts)
          .values({ id: accountId, ownerIssuer: "https://accounts.google.com", ownerSubject, state: "active" })
          .onConflictDoNothing();
        const [saved] = await transaction.select().from(accounts).where(eq(accounts.id, accountId));
        if (
          saved.state !== "active" ||
          saved.ownerSubject !== ownerSubject ||
          saved.ownerIssuer !== "https://accounts.google.com"
        )
          throw new Error("Account unavailable");
        return { accountId };
      });
    },
  };
};
