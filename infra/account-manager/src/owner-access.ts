import { and, eq, sql } from "drizzle-orm";
import { identitySchema } from "pstdio-sync-contracts";
import { account, session } from "./auth-schema";
import { registrationSchema, replacementSchema, revokeSchema } from "./contracts";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { listEnvironments } from "./environments";
import {
  registerCredentialInTransaction,
  replaceCredentialInTransaction,
  revokeCredentialsInTransaction,
} from "./grants";
import { accounts } from "./schema";
import { withAccountTransaction } from "./transactions";

type SessionReader = (headers: Headers) => Promise<{ user: { id: string }; session: { id: string } } | null>;

export const createOwnerAccess = (
  db: ManagerDatabase,
  readSession: SessionReader,
  headers: Headers,
  accountId: string,
) => {
  const apply = async <T>(action: (transaction: ManagerTransaction) => Promise<T>) => {
    try {
      identitySchema.parse(accountId);
      const current = await readSession(headers);
      if (!current) throw new Error("Unavailable session");
      return await withAccountTransaction(db, accountId, async (transaction) => {
        const [owner] = await transaction
          .select({ id: accounts.id })
          .from(accounts)
          .innerJoin(account, and(eq(account.providerId, "google"), eq(account.accountId, accounts.ownerSubject)))
          .innerJoin(session, eq(session.userId, account.userId))
          .where(
            and(
              eq(accounts.id, accountId),
              eq(accounts.state, "active"),
              eq(accounts.ownerIssuer, "https://accounts.google.com"),
              eq(account.userId, current.user.id),
              eq(session.id, current.session.id),
              sql`${session.expiresAt} > clock_timestamp()`,
            ),
          )
          .for("share");
        if (!owner) throw new Error("Unavailable owner");
        return action(transaction);
      });
    } catch {
      throw new Error("Owner access unavailable");
    }
  };
  const registration = registrationSchema.omit({ accountId: true });
  const replacement = replacementSchema.omit({ accountId: true });
  const revocation = revokeSchema.omit({ accountId: true });
  return {
    register: (input: unknown) =>
      apply((transaction) => registerCredentialInTransaction(transaction, { ...registration.parse(input), accountId })),
    replace: (input: unknown) =>
      apply((transaction) => replaceCredentialInTransaction(transaction, { ...replacement.parse(input), accountId })),
    revoke: (input: unknown) =>
      apply((transaction) => revokeCredentialsInTransaction(transaction, { ...revocation.parse(input), accountId })),
    environments: () => apply((transaction) => listEnvironments(transaction, accountId)),
  };
};
