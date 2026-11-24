import { and, asc, desc, eq, gt, gte, or, sql } from "drizzle-orm";
import {
  type JoinedTeam,
  type TeamInvitationView,
  type TeamInviteRecipient,
  teamInviteSecretSchema,
} from "pstdio-sync-contracts";
import { account, user } from "./auth-schema";
import { createCredential, digestCredential } from "./credential";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import {
  accounts,
  googleIdentityClaims,
  microsoftIdentityClaims,
  teamInvitations,
  teamMemberRevocations,
  teamMembers,
  teams,
} from "./schema";
import { rotateProjectSharedKeys } from "./space-keys";
import { teamUserProjectIds } from "./team-project-access";
import { TeamMembershipDenied } from "./teams";
import { lockAccount } from "./transactions";

const google = "https://accounts.google.com";
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
type Invitation = typeof teamInvitations.$inferSelect;

const googleAccount = and(
  eq(accounts.ownerIssuer, google),
  eq(account.providerId, "google"),
  eq(account.accountId, accounts.ownerSubject),
);
const microsoftAccount = and(
  sql`${accounts.ownerIssuer} like 'https://login.microsoftonline.com/%/v2.0'`,
  eq(account.providerId, "microsoft"),
  eq(account.accountId, sql`split_part(${accounts.ownerIssuer}, '/', 4) || ':' || ${accounts.ownerSubject}`),
);
const microsoftClaimsForAccount = and(
  eq(microsoftIdentityClaims.issuer, accounts.ownerIssuer),
  eq(microsoftIdentityClaims.subject, accounts.ownerSubject),
);
const rosterUser = and(
  eq(user.id, account.userId),
  or(eq(account.providerId, "microsoft"), eq(user.emailVerified, true)),
);

export const verifiedGoogleEmail = async (transaction: ManagerTransaction, userId: string) => {
  const [claim] = await transaction
    .select({ email: googleIdentityClaims.verifiedEmail })
    .from(accounts)
    .innerJoin(googleIdentityClaims, eq(googleIdentityClaims.subject, accounts.ownerSubject))
    .where(and(eq(accounts.id, userId), eq(accounts.ownerIssuer, google), eq(accounts.state, "active")))
    .for("share", { of: googleIdentityClaims });
  return claim?.email ?? undefined;
};

const verifiedMicrosoftRecipient = async (transaction: ManagerTransaction, userId: string) => {
  const [claim] = await transaction
    .select({ tenantId: microsoftIdentityClaims.tenantId, objectId: microsoftIdentityClaims.objectId })
    .from(accounts)
    .innerJoin(microsoftIdentityClaims, microsoftClaimsForAccount)
    .where(and(eq(accounts.id, userId), eq(accounts.state, "active")))
    .for("share", { of: microsoftIdentityClaims });
  return claim;
};

export const listTeamMembers = (transaction: ManagerTransaction, accountId: string) =>
  transaction
    .select({
      userId: teamMembers.userId,
      name: sql<string>`coalesce(max(${user.name}), ${teamMembers.userId})`,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(accounts, eq(accounts.id, teamMembers.userId))
    .leftJoin(account, or(googleAccount, microsoftAccount))
    .leftJoin(user, rosterUser)
    .where(eq(teamMembers.accountId, accountId))
    .groupBy(teamMembers.userId, teamMembers.role)
    .orderBy(desc(teamMembers.role), asc(teamMembers.userId));

const pendingFor = (accountId: string) =>
  and(eq(teamInvitations.accountId, accountId), eq(teamInvitations.state, "pending"));

type RecipientColumns = Pick<Invitation, "email" | "microsoftTenantId" | "microsoftObjectId">;
const recipientOf = ({ email, microsoftTenantId, microsoftObjectId }: RecipientColumns): TeamInviteRecipient =>
  microsoftTenantId !== null && microsoftObjectId !== null
    ? { microsoft: { tenantId: microsoftTenantId, objectId: microsoftObjectId } }
    : { email: email ?? undefined };

const invitationTargets = ({ email, microsoft }: TeamInviteRecipient) => {
  if (microsoft) {
    return and(
      eq(teamInvitations.microsoftTenantId, microsoft.tenantId),
      eq(teamInvitations.microsoftObjectId, microsoft.objectId),
    );
  }
  if (email !== undefined) return eq(teamInvitations.email, email);
  return sql`false`;
};

export const listTeamInvitations = async (transaction: ManagerTransaction, accountId: string) => {
  const rows = await transaction
    .select({
      id: teamInvitations.id,
      expiresAt: teamInvitations.expiresAt,
      email: teamInvitations.email,
      microsoftTenantId: teamInvitations.microsoftTenantId,
      microsoftObjectId: teamInvitations.microsoftObjectId,
    })
    .from(teamInvitations)
    .where(and(pendingFor(accountId), gt(teamInvitations.expiresAt, new Date())))
    .orderBy(asc(teamInvitations.expiresAt), asc(teamInvitations.id));
  return rows.map((row) => ({ id: row.id, expiresAt: row.expiresAt.toISOString(), ...recipientOf(row) }));
};

export const createTeamInvitation = async (
  transaction: ManagerTransaction,
  accountId: string,
  recipient: TeamInviteRecipient,
) => {
  const { email, microsoft } = recipient;
  const [member] = await transaction
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .innerJoin(accounts, eq(accounts.id, teamMembers.userId))
    .leftJoin(
      googleIdentityClaims,
      and(eq(accounts.ownerIssuer, google), eq(googleIdentityClaims.subject, accounts.ownerSubject)),
    )
    .leftJoin(microsoftIdentityClaims, microsoftClaimsForAccount)
    .where(
      and(
        eq(teamMembers.accountId, accountId),
        microsoft
          ? and(
              eq(microsoftIdentityClaims.tenantId, microsoft.tenantId),
              eq(microsoftIdentityClaims.objectId, microsoft.objectId),
            )
          : eq(googleIdentityClaims.verifiedEmail, email ?? ""),
      ),
    )
    .limit(1);
  if (member) throw new TeamMembershipDenied("This person is already a team member");

  await transaction
    .update(teamInvitations)
    .set({ state: "canceled" })
    .where(and(pendingFor(accountId), invitationTargets(recipient)));
  const id = crypto.randomUUID();
  const secret = createCredential();
  const expiresAt = new Date(Date.now() + invitationLifetimeMs);
  await transaction.insert(teamInvitations).values({
    id,
    accountId,
    email,
    microsoftTenantId: microsoft?.tenantId,
    microsoftObjectId: microsoft?.objectId,
    digest: digestCredential(secret),
    expiresAt,
    state: "pending",
  });
  return { id, ...recipient, secret, expiresAt: expiresAt.toISOString() };
};

export const cancelTeamInvitation = async (transaction: ManagerTransaction, accountId: string, id: string) => {
  await transaction
    .update(teamInvitations)
    .set({ state: "canceled" })
    .where(and(pendingFor(accountId), eq(teamInvitations.id, id)));
};

export const removeTeamMember = async (transaction: ManagerTransaction, accountId: string, userId: string) => {
  const projects = await teamUserProjectIds(transaction, accountId, userId);
  const [removed] = await transaction
    .delete(teamMembers)
    .where(and(eq(teamMembers.accountId, accountId), eq(teamMembers.userId, userId), eq(teamMembers.role, "member")))
    .returning({ userId: teamMembers.userId });
  if (!removed) return;
  if (projects.length) await rotateProjectSharedKeys(transaction, accountId, projects);

  const revokedAt = sql`clock_timestamp()`;
  await transaction
    .insert(teamMemberRevocations)
    .values({ accountId, userId, revokedAt })
    .onConflictDoUpdate({
      target: [teamMemberRevocations.accountId, teamMemberRevocations.userId],
      set: { revokedAt },
    });
  const email = await verifiedGoogleEmail(transaction, userId);
  const microsoft = await verifiedMicrosoftRecipient(transaction, userId);
  await transaction
    .update(teamInvitations)
    .set({ state: "canceled", acceptedBy: null })
    .where(
      and(
        eq(teamInvitations.accountId, accountId),
        or(eq(teamInvitations.acceptedBy, userId), and(pendingFor(accountId), invitationTargets({ email, microsoft }))),
      ),
    );
};

const readInvitation = async (transaction: Pick<ManagerDatabase, "select">, digest: string) =>
  (
    await transaction
      .select({ invitation: teamInvitations, teamName: teams.name })
      .from(teamInvitations)
      .innerJoin(teams, eq(teams.accountId, teamInvitations.accountId))
      .innerJoin(accounts, eq(accounts.id, teams.accountId))
      .where(and(eq(teamInvitations.digest, digest), eq(accounts.state, "active")))
  )[0];

export const teamInvitationProvider = async (db: ManagerDatabase, secret: string) => {
  const row = await readInvitation(db, digestCredential(secret));
  return row?.invitation.microsoftObjectId == null ? undefined : "microsoft";
};

const describeInvitation = async (
  transaction: ManagerTransaction,
  invitation: Invitation,
  userId: string,
  signedInEmail: string | undefined,
): Promise<TeamInvitationView["state"]> => {
  if (invitation.state === "canceled") return "canceled";
  if (invitation.state === "accepted") {
    if (invitation.acceptedBy !== userId) return "consumed";
    const [member] = await transaction
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(and(eq(teamMembers.accountId, invitation.accountId), eq(teamMembers.userId, userId)));
    return member ? "joined" : "consumed";
  }
  if (invitation.expiresAt.getTime() <= Date.now()) return "expired";
  if (invitation.microsoftObjectId !== null) {
    const directory = await verifiedMicrosoftRecipient(transaction, userId);
    if (directory?.tenantId !== invitation.microsoftTenantId || directory?.objectId !== invitation.microsoftObjectId)
      return "wrong-identity";
  } else if (!signedInEmail || invitation.email !== signedInEmail) {
    return "wrong-identity";
  }
  const [revoked] = await transaction
    .select({ userId: teamMemberRevocations.userId })
    .from(teamMemberRevocations)
    .innerJoin(teamInvitations, eq(teamInvitations.id, invitation.id))
    .where(
      and(
        eq(teamMemberRevocations.accountId, invitation.accountId),
        eq(teamMemberRevocations.userId, userId),
        gte(teamMemberRevocations.revokedAt, teamInvitations.issuedAt),
      ),
    );
  return revoked ? "canceled" : "pending";
};

export const inspectTeamInvitation = async (
  transaction: ManagerTransaction,
  userId: string,
  value: unknown,
): Promise<TeamInvitationView> => {
  const digest = digestCredential(teamInviteSecretSchema.parse(value));
  const signedInEmail = await verifiedGoogleEmail(transaction, userId);
  const row = await readInvitation(transaction, digest);
  if (!row) return { state: "unknown", signedInEmail };
  const state = await describeInvitation(transaction, row.invitation, userId, signedInEmail);
  return {
    state,
    teamName: row.teamName,
    signedInEmail,
    ...(row.invitation.microsoftObjectId !== null && { provider: "microsoft" }),
  };
};

export const acceptTeamInvitation = async (
  transaction: ManagerTransaction,
  userId: string,
  value: unknown,
): Promise<JoinedTeam> => {
  const digest = digestCredential(teamInviteSecretSchema.parse(value));
  const beforeLock = await readInvitation(transaction, digest);
  if (!beforeLock) throw new TeamMembershipDenied("Invitation unavailable");

  const { accountId } = beforeLock.invitation;
  await lockAccount(transaction, accountId);
  const row = await readInvitation(transaction, digest);
  if (!row) throw new TeamMembershipDenied("Invitation unavailable");

  const signedInEmail = await verifiedGoogleEmail(transaction, userId);
  const state = await describeInvitation(transaction, row.invitation, userId, signedInEmail);
  if (state === "joined") return { state, accountId };
  if (state !== "pending") throw new TeamMembershipDenied("Invitation cannot be accepted");

  await transaction.insert(teamMembers).values({ accountId, userId, role: "member" }).onConflictDoNothing();
  await transaction
    .update(teamInvitations)
    .set({ state: "accepted", acceptedBy: userId })
    .where(eq(teamInvitations.id, row.invitation.id));
  return { state: "joined", accountId };
};
