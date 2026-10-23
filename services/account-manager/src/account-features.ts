import { and, eq, exists, sql } from "drizzle-orm";
import { z } from "zod";
import { account, user } from "./auth-schema";
import { accountFeatureSchema } from "./contracts";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { accountFeatures, accounts } from "./schema";
import { withAccountTransaction } from "./transactions";

type Reader = Pick<ManagerDatabase, "select">;

export const relayEnabled = (db: Reader, accountId: string) =>
  exists(
    db
      .select()
      .from(accountFeatures)
      .where(and(eq(accountFeatures.accountId, accountId), eq(accountFeatures.feature, "relay"))),
  );

export const readAccountFeatures = async (db: Reader, accountId: string) => {
  const [grant] = await db
    .select({ feature: accountFeatures.feature })
    .from(accountFeatures)
    .where(and(eq(accountFeatures.accountId, accountId), eq(accountFeatures.feature, "relay")));
  return { relay: !!grant };
};

export class AccountFeatureDenied extends Error {}

export const requireRelay = async (db: Reader, accountId: string) => {
  if (!(await readAccountFeatures(db, accountId)).relay)
    throw new AccountFeatureDenied("Cloud early access is not enabled for this account");
};

export const setAccountFeatureInTransaction = async (
  transaction: ManagerTransaction,
  input: z.infer<typeof accountFeatureSchema>,
) => {
  const intent = accountFeatureSchema.parse(input);
  const [known] = await transaction.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, intent.accountId));
  if (!known) throw new Error("Unknown account");
  const { accountId, feature } = intent;
  if (intent.enabled) await transaction.insert(accountFeatures).values({ accountId, feature }).onConflictDoNothing();
  else
    await transaction
      .delete(accountFeatures)
      .where(and(eq(accountFeatures.accountId, accountId), eq(accountFeatures.feature, feature)));
};

export const setAccountFeatureByEmail = async (
  db: ManagerDatabase,
  input: { email: string; feature: "relay"; enabled: boolean },
) => {
  const email = z.email().parse(input.email.trim());
  const matches = await db
    .selectDistinct({ accountId: accounts.id })
    .from(accounts)
    .innerJoin(account, and(eq(account.providerId, "google"), eq(account.accountId, accounts.ownerSubject)))
    .innerJoin(user, eq(user.id, account.userId))
    .where(
      and(
        eq(accounts.ownerIssuer, "https://accounts.google.com"),
        sql`lower(${user.email}) = ${email.toLowerCase()}`,
        eq(user.emailVerified, true),
      ),
    );
  if (matches.length !== 1)
    throw new Error("No unique account with that verified Google email. Sign in once before granting a feature.");
  const { accountId } = matches[0];
  await withAccountTransaction(db, accountId, (transaction) =>
    setAccountFeatureInTransaction(transaction, { accountId, feature: input.feature, enabled: input.enabled }),
  );
  return { accountId, feature: input.feature, enabled: input.enabled };
};
