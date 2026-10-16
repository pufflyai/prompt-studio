import { and, eq, gt, lte, sql } from "drizzle-orm";
import { type BeginLoginInput, beginLoginSchema, type CompleteLoginInput, completeLoginSchema } from "./contracts";
import { createCredential, digestCredential } from "./credential";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { accounts, loginChallenges, ownerSessions } from "./schema";
import { withAccountTransaction, withManagerTransaction } from "./transactions";

const futureExpiry = async (transaction: ManagerTransaction, expiresAt: string) => {
  const result = await transaction.execute(sql`SELECT ${expiresAt}::timestamptz > clock_timestamp() AS valid`);
  if (result.rows[0].valid !== true) throw new Error("Login expiry must be in the future");
  return new Date(expiresAt);
};
const pendingChallenge = (state: string, binding: string) =>
  and(
    eq(loginChallenges.stateDigest, digestCredential(state)),
    eq(loginChallenges.bindingDigest, digestCredential(binding)),
    gt(loginChallenges.expiresAt, sql`clock_timestamp()`),
  );

export const beginLogin = (db: ManagerDatabase, input: BeginLoginInput) => {
  const intent = beginLoginSchema.parse(input);
  return withManagerTransaction(db, async (transaction) => {
    const expiresAt = await futureExpiry(transaction, intent.expiresAt);
    const state = createCredential();
    const binding = createCredential();
    const nonce = createCredential();
    await transaction.delete(loginChallenges).where(lte(loginChallenges.expiresAt, sql`clock_timestamp()`));
    await transaction.delete(ownerSessions).where(lte(ownerSessions.expiresAt, sql`clock_timestamp()`));
    await transaction.insert(loginChallenges).values({
      stateDigest: digestCredential(state),
      bindingDigest: digestCredential(binding),
      nonce,
      expiresAt,
    });
    return { state, binding, nonce };
  });
};

export const loginChallenge = async (db: ManagerDatabase, state: string, binding: string) =>
  (
    await db.select({ nonce: loginChallenges.nonce }).from(loginChallenges).where(pendingChallenge(state, binding))
  )[0] ?? null;

export const completeLogin = (db: ManagerDatabase, input: CompleteLoginInput) => {
  const intent = completeLoginSchema.parse(input);
  return withAccountTransaction(db, intent.accountId, async (transaction) => {
    const expiresAt = await futureExpiry(transaction, intent.expiresAt);
    const account = (await transaction.select().from(accounts).where(eq(accounts.id, intent.accountId)))[0];
    if (
      account?.state !== "active" ||
      account.ownerIssuer !== intent.owner.issuer ||
      account.ownerSubject !== intent.owner.subject
    )
      throw new Error("Login requires the current active account owner");
    const consumed = await transaction
      .delete(loginChallenges)
      .where(pendingChallenge(intent.state, intent.binding))
      .returning({ stateDigest: loginChallenges.stateDigest });
    if (!consumed.length) throw new Error("Login challenge is unavailable");
    const token = createCredential();
    await transaction
      .insert(ownerSessions)
      .values({ accountId: intent.accountId, digest: digestCredential(token), expiresAt });
    return { accountId: intent.accountId, expiresAt: intent.expiresAt, token };
  });
};

export const logout = (db: ManagerDatabase, token: string) =>
  withManagerTransaction(db, async (transaction) => {
    await transaction.delete(ownerSessions).where(eq(ownerSessions.digest, digestCredential(token)));
  });

export const authorizeSession = async (db: ManagerDatabase, token: string) =>
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
