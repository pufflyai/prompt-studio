import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { createCredential, digestCredential } from "./credential";
import type { ManagerTransaction } from "./database";
import { teamInvitations } from "./schema";

const codeRecipient = () =>
  and(
    isNull(teamInvitations.email),
    isNull(teamInvitations.microsoftTenantId),
    isNull(teamInvitations.microsoftObjectId),
  );

export const createTeamInviteCode = async (transaction: ManagerTransaction, accountId: string) => {
  const id = crypto.randomUUID();
  const code = createCredential();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await transaction.insert(teamInvitations).values({
    id,
    accountId,
    digest: digestCredential(code),
    expiresAt,
    state: "pending",
  });
  return { id, code, expiresAt: expiresAt.toISOString() };
};

export const listTeamInviteCodes = async (transaction: ManagerTransaction, accountId: string) => {
  const rows = await transaction
    .select({ id: teamInvitations.id, expiresAt: teamInvitations.expiresAt })
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.accountId, accountId),
        eq(teamInvitations.state, "pending"),
        gt(teamInvitations.expiresAt, new Date()),
        codeRecipient(),
      ),
    )
    .orderBy(asc(teamInvitations.expiresAt), asc(teamInvitations.id));
  return rows.map(({ id, expiresAt }) => ({ id, expiresAt: expiresAt.toISOString() }));
};

// A departed member must not reuse an outstanding bearer code through a fresh identity.
export const cancelTeamInviteCodes = (transaction: ManagerTransaction, accountId: string) =>
  transaction
    .update(teamInvitations)
    .set({ state: "canceled" })
    .where(and(eq(teamInvitations.accountId, accountId), eq(teamInvitations.state, "pending"), codeRecipient()));
