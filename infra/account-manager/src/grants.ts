import { and, eq, isNull, sql } from "drizzle-orm";
import {
  grantSchema,
  type RegistrationInput,
  type ReplacementInput,
  type RevokeInput,
  registrationSchema,
  replacementSchema,
  revokeSchema,
} from "./contracts";
import { createCredential, digestCredential } from "./credential";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { recordRequest } from "./requests";
import { accounts, credentials, workbenches } from "./schema";
import { withAccountTransaction } from "./transactions";

const issue = async (transaction: ManagerTransaction, intent: RegistrationInput, token: string) => {
  const account = (await transaction.select().from(accounts).where(eq(accounts.id, intent.accountId)))[0];
  if (account?.state !== "active") throw new Error("Account is not active");
  const expiresAt = new Date(intent.expiresAt);
  if (expiresAt <= new Date()) throw new Error("Credential expiry must be in the future");
  const grant = {
    id: crypto.randomUUID(),
    accountId: intent.accountId,
    workbenchId: intent.workbenchId,
    environmentId: intent.environmentId,
    expiresAt: intent.expiresAt,
  };
  await transaction
    .insert(workbenches)
    .values({ accountId: intent.accountId, id: intent.workbenchId })
    .onConflictDoNothing();
  await transaction.insert(credentials).values({ ...grant, expiresAt, digest: digestCredential(token) });
  return grant;
};

export const registerCredentialInTransaction = async (transaction: ManagerTransaction, intent: RegistrationInput) => {
  const token = createCredential();
  const saved = await recordRequest(transaction, intent, "register", intent, (current) =>
    issue(current, intent, token),
  );
  return { ...grantSchema.parse(saved.result), token: saved.created ? token : null };
};

export const registerCredential = (db: ManagerDatabase, input: RegistrationInput) => {
  const intent = registrationSchema.parse(input);
  return withAccountTransaction(db, intent.accountId, (transaction) =>
    registerCredentialInTransaction(transaction, intent),
  );
};

export const replaceCredentialInTransaction = async (transaction: ManagerTransaction, intent: ReplacementInput) => {
  const token = createCredential();
  const saved = await recordRequest(transaction, intent, "replace", intent, async (transaction) => {
    const replaced = await transaction
      .update(credentials)
      .set({ revokedAt: sql`clock_timestamp()` })
      .where(
        and(
          eq(credentials.id, intent.replacesId),
          eq(credentials.accountId, intent.accountId),
          eq(credentials.workbenchId, intent.workbenchId),
          eq(credentials.environmentId, intent.environmentId),
          isNull(credentials.revokedAt),
        ),
      )
      .returning({ id: credentials.id });
    if (!replaced.length) throw new Error("Credential replacement is stale");
    return issue(transaction, intent, token);
  });
  return { ...grantSchema.parse(saved.result), token: saved.created ? token : null };
};

export const replaceCredential = (db: ManagerDatabase, input: ReplacementInput) => {
  const intent = replacementSchema.parse(input);
  return withAccountTransaction(db, intent.accountId, (transaction) =>
    replaceCredentialInTransaction(transaction, intent),
  );
};

export const revokeCredentialsInTransaction = async (transaction: ManagerTransaction, intent: RevokeInput) => {
  await recordRequest(transaction, intent, "revoke", intent, async (current) => {
    await current
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
};

export const revokeCredentials = (db: ManagerDatabase, input: RevokeInput) => {
  const intent = revokeSchema.parse(input);
  return withAccountTransaction(db, intent.accountId, (transaction) =>
    revokeCredentialsInTransaction(transaction, intent),
  );
};
