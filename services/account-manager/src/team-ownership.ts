import { and, eq } from "drizzle-orm";
import type { TeamOwnershipDecision } from "pstdio-sync-contracts";
import type { ManagerTransaction } from "./database";
import { accounts, teamMembers, teamOwnershipOffers } from "./schema";
import { TeamMembershipDenied } from "./teams";

const find = async (transaction: ManagerTransaction, accountId: string) => {
  const [row] = await transaction
    .select()
    .from(teamOwnershipOffers)
    .where(eq(teamOwnershipOffers.accountId, accountId));
  return row;
};

const publicOffer = ({ id, ownerUserId, recipientUserId }: typeof teamOwnershipOffers.$inferSelect) => ({
  id,
  ownerUserId,
  recipientUserId,
});

export const readOwnershipOffer = async (transaction: ManagerTransaction, accountId: string, userId: string) => {
  const offer = await find(transaction, accountId);
  return offer?.state === "pending" && (offer.recipientUserId === userId || offer.ownerUserId === userId)
    ? publicOffer(offer)
    : null;
};

const activeMember = async (transaction: ManagerTransaction, accountId: string, userId: string) => {
  const [member] = await transaction
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .innerJoin(accounts, eq(accounts.id, teamMembers.userId))
    .where(
      and(
        eq(teamMembers.accountId, accountId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, "member"),
        eq(accounts.state, "active"),
      ),
    );
  return Boolean(member);
};

// All offer and role changes occur under the same owning team lock as membership and grants.
export const createOwnershipOffer = async (
  transaction: ManagerTransaction,
  accountId: string,
  ownerUserId: string,
  recipientUserId: string,
) => {
  if (!(await activeMember(transaction, accountId, recipientUserId)))
    throw new TeamMembershipDenied("Offer team ownership to an active member");
  const current = await find(transaction, accountId);
  if (current?.state === "pending") {
    if (current.ownerUserId === ownerUserId && current.recipientUserId === recipientUserId) return publicOffer(current);
    throw new TeamMembershipDenied("Cancel the current ownership offer first");
  }
  const next = { id: crypto.randomUUID(), ownerUserId, recipientUserId, state: "pending" as const };
  await transaction
    .insert(teamOwnershipOffers)
    .values({ accountId, ...next })
    .onConflictDoUpdate({ target: teamOwnershipOffers.accountId, set: next });
  return publicOffer({ accountId, ...next });
};

const setRole = async (
  transaction: ManagerTransaction,
  accountId: string,
  userId: string,
  before: "owner" | "member",
  role: "owner" | "member",
) => {
  const [updated] = await transaction
    .update(teamMembers)
    .set({ role })
    .where(and(eq(teamMembers.accountId, accountId), eq(teamMembers.userId, userId), eq(teamMembers.role, before)))
    .returning({ userId: teamMembers.userId });
  if (!updated) throw new TeamMembershipDenied("The team ownership offer is unavailable");
};

const outcomes = { accept: "accepted", decline: "declined", cancel: "canceled" } as const;

export const finishOwnershipOffer = async (
  transaction: ManagerTransaction,
  accountId: string,
  userId: string,
  offerId: string,
  decision: TeamOwnershipDecision,
) => {
  const offer = await find(transaction, accountId);
  const actor = decision === "cancel" ? offer?.ownerUserId : offer?.recipientUserId;
  if (!offer || offer.id !== offerId || actor !== userId)
    throw new TeamMembershipDenied("The team ownership offer is unavailable");
  const state = outcomes[decision];
  if (offer.state === state) return;
  if (offer.state !== "pending") throw new TeamMembershipDenied("The team ownership offer is unavailable");

  if (decision === "accept") {
    if (!(await activeMember(transaction, accountId, offer.recipientUserId)))
      throw new TeamMembershipDenied("The team ownership recipient is unavailable");
    // Demote first to respect the unique-owner index. The transaction publishes both roles together.
    await setRole(transaction, accountId, offer.ownerUserId, "owner", "member");
    await setRole(transaction, accountId, offer.recipientUserId, "member", "owner");
  }
  await transaction.update(teamOwnershipOffers).set({ state }).where(eq(teamOwnershipOffers.accountId, accountId));
};

export const cancelOwnershipOnRemoval = (transaction: ManagerTransaction, accountId: string, userId: string) =>
  transaction
    .update(teamOwnershipOffers)
    .set({ state: "canceled" })
    .where(
      and(
        eq(teamOwnershipOffers.accountId, accountId),
        eq(teamOwnershipOffers.recipientUserId, userId),
        eq(teamOwnershipOffers.state, "pending"),
      ),
    );
