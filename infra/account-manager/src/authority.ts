import { and, eq, isNull, sql } from "drizzle-orm";
import { canonicalJson, identitySchema } from "pstdio-sync-contracts";
import {
  type AccountRequest,
  accountRequestSchema,
  type ProvisionInput,
  provisionSchema,
  type ReconciliationInput,
  type RegistrationInput,
  type ReplacementInput,
  type RevokeInput,
  reconciliationSchema,
  revokeSchema,
} from "./contracts";
import { connectManager } from "./database";
import { digestCredential, registerCredential, replaceCredential } from "./grants";
import { captureManager, restoreManager } from "./recovery";
import { executeRequest } from "./requests";
import { accounts, credentials } from "./schema";

export const createAccountManager = (databaseUrl: string) => {
  const connection = connectManager(databaseUrl);
  return {
    async provision(input: ProvisionInput) {
      const intent = provisionSchema.parse(input);
      const saved = await executeRequest(connection.db, intent, "provision", intent, async (transaction) => {
        await transaction
          .insert(accounts)
          .values({
            id: intent.accountId,
            ownerIssuer: intent.owner.issuer,
            ownerSubject: intent.owner.subject,
            state: "active",
          })
          .onConflictDoNothing();
        const row = (await transaction.select().from(accounts).where(eq(accounts.id, intent.accountId)))[0];
        if (canonicalJson({ issuer: row.ownerIssuer, subject: row.ownerSubject }) !== canonicalJson(intent.owner))
          throw new Error("Account identity has another owner");
        return { accountId: row.id };
      });
      return { accountId: identitySchema.parse(saved.result.accountId) };
    },
    async register(input: RegistrationInput) {
      return registerCredential(connection.db, input);
    },
    async replace(input: ReplacementInput) {
      return replaceCredential(connection.db, input);
    },
    async revoke(input: RevokeInput) {
      const intent = revokeSchema.parse(input);
      await executeRequest(connection.db, intent, "revoke", intent, async (transaction) => {
        await transaction
          .update(credentials)
          .set({ revokedAt: sql`clock_timestamp()` })
          .where(
            and(
              eq(credentials.accountId, intent.accountId),
              eq(credentials.environmentId, intent.environmentId),
              isNull(credentials.revokedAt),
            ),
          );
        return {};
      });
    },
    async disable(input: AccountRequest) {
      const intent = accountRequestSchema.parse(input);
      await executeRequest(connection.db, intent, "disable", intent, async (transaction) => {
        const rows = await transaction
          .update(accounts)
          .set({ state: "disabled" })
          .where(eq(accounts.id, intent.accountId))
          .returning({ id: accounts.id });
        if (!rows.length) throw new Error("Unknown account");
        return { accountId: intent.accountId };
      });
    },
    async reconcile(input: ReconciliationInput) {
      const intent = reconciliationSchema.parse(input);
      await executeRequest(connection.db, intent, "reconcile", intent, async (transaction) => {
        await transaction
          .update(credentials)
          .set({ revokedAt: sql`clock_timestamp()` })
          .where(and(eq(credentials.accountId, intent.accountId), isNull(credentials.revokedAt)));
        const rows = await transaction
          .update(accounts)
          .set({ ownerIssuer: intent.owner.issuer, ownerSubject: intent.owner.subject, state: intent.state })
          .where(eq(accounts.id, intent.accountId))
          .returning({ id: accounts.id });
        if (!rows.length) throw new Error("Unknown account");
        return { accountId: intent.accountId };
      });
    },
    snapshot: () => captureManager(connection.db),
    restore: (requestId: string, input: unknown) => restoreManager(connection.db, requestId, input),
    async environments(accountId: string) {
      identitySchema.parse(accountId);
      const rows = await connection.db
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
    },
    async authorize(token: string, workbenchId: string) {
      identitySchema.parse(workbenchId);
      const rows = await connection.db
        .select({
          accountId: credentials.accountId,
          workbenchId: credentials.workbenchId,
          environmentId: credentials.environmentId,
        })
        .from(credentials)
        .innerJoin(accounts, eq(accounts.id, credentials.accountId))
        .where(
          and(
            eq(credentials.digest, digestCredential(token)),
            eq(credentials.workbenchId, workbenchId),
            eq(accounts.state, "active"),
            isNull(credentials.revokedAt),
            sql`${credentials.expiresAt} > clock_timestamp()`,
          ),
        );
      return rows[0] ?? null;
    },
    close: connection.close,
  };
};
