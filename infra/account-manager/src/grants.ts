import { and, eq, isNull, sql } from "drizzle-orm";
import {
  grantSchema,
  type RegistrationInput,
  type ReplacementInput,
  registrationSchema,
  replacementSchema,
} from "./contracts";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { executeRequest } from "./requests";
import { accounts, credentials, workbenches } from "./schema";

export const digestCredential = (token: string) => new Bun.CryptoHasher("sha256").update(token).digest("hex");
const mint = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

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

export const registerCredential = async (db: ManagerDatabase, input: RegistrationInput) => {
  const intent = registrationSchema.parse(input);
  const token = mint();
  const saved = await executeRequest(db, intent, "register", intent, (transaction) =>
    issue(transaction, intent, token),
  );
  return { ...grantSchema.parse(saved.result), token: saved.created ? token : null };
};

export const replaceCredential = async (db: ManagerDatabase, input: ReplacementInput) => {
  const intent = replacementSchema.parse(input);
  const token = mint();
  const saved = await executeRequest(db, intent, "replace", intent, async (transaction) => {
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
