import { and, asc, eq } from "drizzle-orm";
import {
  type AccountSignInProvider,
  accountSignInProviderSchema,
  identitySchema,
  type TeamInviteRecipient,
  type TeamOwnershipDecision,
} from "pstdio-sync-contracts";
import { readAccountFeatures, requireRelay } from "./account-features";
import { deviceNameSchema, deviceProfileSchema } from "./contracts";
import { digestCredential } from "./credential";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { readDeviceSigningKey, registerDeviceSigningKey } from "./device-signing-keys";
import {
  accountOfCredential,
  addWorkbenchInTransaction,
  findDevice,
  heartbeatDeviceInTransaction,
  listDevices,
  listWorkbenches,
  registerDeviceInTransaction,
  removeDeviceInTransaction,
  removeWorkbenchInTransaction,
  renameDeviceInTransaction,
} from "./devices";
import { admitsManagedHost } from "./managed-host-admission";
import { listOutstandingProjectDeletions, readProjectDeletion, startProjectDeletion } from "./project-deletion";
import { readProviderIdentity } from "./provider-identity";
import { DeviceAccessDenied } from "./renewal-errors";
import { accounts, projectMembers, teams } from "./schema";
import { hasProjectKeyHistory, spaceKeysInTransaction } from "./space-keys";
import { resolveTeamCapabilities } from "./team-capabilities";
import {
  acceptTeamInvitation,
  cancelTeamInvitation,
  createTeamInvitation,
  inspectTeamInvitation,
  listTeamInvitations,
  listTeamMembers,
  removeTeamMember,
} from "./team-invitations";
import { createTeamInviteCode, listTeamInviteCodes } from "./team-invite-codes";
import { createOwnershipOffer, finishOwnershipOffer, readOwnershipOffer } from "./team-ownership";
import { listTeamProjectAccess, teamProjectGrant, updateTeamProjectGrant } from "./team-project-access";
import { createTeam, listTeams, requireTeamMember, TeamMembershipDenied } from "./teams";
import { lockAccount, withAccountTransaction } from "./transactions";

type SessionReader = (headers: Headers) => Promise<{ user: { id: string } } | null>;
type Device = { accountId: string; deviceId: string };

export const createPersonalAccountAccess =
  (db: ManagerDatabase, readSession: SessionReader) =>
  async <T>(
    headers: Headers,
    action: (transaction: ManagerTransaction, userId: string) => Promise<T>,
    provider?: AccountSignInProvider,
  ) => {
    const session = await readSession(headers);
    if (!session) throw new DeviceAccessDenied();
    const identity = await readProviderIdentity(db, session.user.id);
    if (!identity || (provider && identity.provider !== provider)) throw new DeviceAccessDenied();
    const { issuer, subject } = identity;
    const [owned] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.ownerIssuer, issuer), eq(accounts.ownerSubject, subject)))
      .orderBy(asc(accounts.id))
      .limit(1);
    const accountId = owned?.id ?? digestCredential(`${issuer}\n${subject}`);
    return withAccountTransaction(db, accountId, async (transaction) => {
      await transaction
        .insert(accounts)
        .values({ id: accountId, ownerIssuer: issuer, ownerSubject: subject, state: "active" })
        .onConflictDoNothing();
      const [saved] = await transaction.select().from(accounts).where(eq(accounts.id, accountId));
      if (saved.ownerIssuer !== issuer || saved.ownerSubject !== subject || saved.state !== "active")
        throw new DeviceAccessDenied();
      return action(transaction, accountId);
    });
  };

export const createDeviceLogin =
  (withAccount: ReturnType<typeof createPersonalAccountAccess>) => (headers: Headers, input: unknown) => {
    const { provider, ...profile } = deviceProfileSchema
      .extend({ provider: accountSignInProviderSchema.optional() })
      .parse(input);
    return withAccount(
      headers,
      (transaction, accountId) => registerDeviceInTransaction(transaction, { accountId, ...profile }),
      provider,
    );
  };

// Every other native request carries the device credential. Devices of one account manage each other.
export const createDeviceAccess = (
  db: ManagerDatabase,
  readProfile: (db: ManagerTransaction, accountId: string) => Promise<{ email: string } | undefined>,
) => {
  const apply = async <T>(token: string, action: (transaction: ManagerTransaction, device: Device) => Promise<T>) => {
    const accountId = await accountOfCredential(db, token);
    if (!accountId) throw new DeviceAccessDenied();
    return withAccountTransaction(db, accountId, async (transaction) => {
      const device = await findDevice(transaction, token);
      if (!device) throw new DeviceAccessDenied();
      return action(transaction, device);
    });
  };
  const scoped = <T>(
    token: string,
    selected: string | undefined,
    action: (transaction: ManagerTransaction, accountId: string, userId: string, owner: boolean) => Promise<T>,
  ) =>
    apply(token, async (transaction, device) => {
      const userId = device.accountId;
      const accountId = selected === undefined ? userId : identitySchema.parse(selected);
      if (accountId === userId) return action(transaction, accountId, userId, true);
      await lockAccount(transaction, accountId);
      const member = await requireTeamMember(transaction, accountId, userId);
      return action(transaction, accountId, userId, member.role === "owner");
    });

  const team = <T>(
    token: string,
    intent: string,
    action: (
      transaction: ManagerTransaction,
      accountId: string,
      userId: string,
      role: "owner" | "member",
    ) => Promise<T>,
  ) =>
    apply(token, async (transaction, { accountId: userId }) => {
      const accountId = identitySchema.parse(intent);
      const [known] = await transaction
        .select({ accountId: teams.accountId })
        .from(teams)
        .where(eq(teams.accountId, accountId));
      if (!known) throw new DeviceAccessDenied();
      await lockAccount(transaction, accountId);
      const { role } = await requireTeamMember(transaction, accountId, userId);
      return action(transaction, accountId, userId, role);
    });

  const owner = <T>(
    token: string,
    intent: string,
    action: (transaction: ManagerTransaction, accountId: string, userId: string) => Promise<T>,
  ) =>
    team(token, intent, (transaction, accountId, userId, role) => {
      if (role !== "owner") throw new TeamMembershipDenied("Only the team owner can perform this action");
      return action(transaction, accountId, userId);
    });

  const canManageProject = async (
    transaction: ManagerTransaction,
    accountId: string,
    userId: string,
    workbenchId: string,
  ) =>
    accountId === userId || (await resolveTeamCapabilities(transaction, accountId, userId, workbenchId)).manageProject;

  return {
    members: (token: string, id: string) => team(token, id, listTeamMembers),
    ownershipOffer: (token: string, id: string) => team(token, id, readOwnershipOffer),
    offerOwnership: (token: string, id: string, recipientUserId: string) =>
      owner(token, id, (transaction, accountId, userId) =>
        createOwnershipOffer(transaction, accountId, userId, recipientUserId),
      ),
    finishOwnership: (token: string, id: string, offerId: string, decision: TeamOwnershipDecision) =>
      team(token, id, (transaction, accountId, userId) =>
        finishOwnershipOffer(transaction, accountId, userId, identitySchema.parse(offerId), decision),
      ),
    withTeam: team,
    projectAccess: (token: string, id: string) =>
      team(token, id, (transaction, accountId, userId, role) =>
        listTeamProjectAccess(transaction, accountId, role === "owner" ? undefined : userId),
      ),
    updateProjectAccess: (token: string, id: string, project: string, userId: string, granted: boolean) =>
      team(token, id, async (transaction, accountId, actorId) => {
        const workbenchId = identitySchema.parse(project);
        const capabilities = await resolveTeamCapabilities(transaction, accountId, actorId, workbenchId);
        if (!capabilities.manageProjectAccess) throw new TeamMembershipDenied("Project access is required");
        return updateTeamProjectGrant(transaction, accountId, workbenchId, userId, granted);
      }),
    invitations: (token: string, id: string) => owner(token, id, listTeamInvitations),
    inviteCodes: (token: string, id: string) => owner(token, id, listTeamInviteCodes),
    inviteCode: (token: string, id: string) => owner(token, id, createTeamInviteCode),
    invite: (token: string, id: string, recipient: TeamInviteRecipient) =>
      owner(token, id, (transaction, accountId) => createTeamInvitation(transaction, accountId, recipient)),
    cancelInvitation: (token: string, id: string, inviteId: string) =>
      owner(token, id, (transaction, accountId) =>
        cancelTeamInvitation(transaction, accountId, identitySchema.parse(inviteId)),
      ),
    removeMember: (token: string, id: string, target: string) =>
      owner(token, id, (transaction, accountId, userId) => {
        const memberId = identitySchema.parse(target);
        if (memberId === userId) throw new TeamMembershipDenied("Transfer ownership before leaving the team");
        return removeTeamMember(transaction, accountId, memberId);
      }),
    leave: (token: string, id: string) =>
      team(token, id, (transaction, accountId, userId, role) => {
        if (role === "owner") throw new TeamMembershipDenied("Transfer ownership before leaving the team");
        return removeTeamMember(transaction, accountId, userId);
      }),
    inspectInvitation: (token: string, secret: unknown) =>
      apply(token, (transaction, { accountId }) => inspectTeamInvitation(transaction, accountId, secret)),
    acceptInvitation: (token: string, secret: unknown) =>
      apply(token, (transaction, { accountId }) => acceptTeamInvitation(transaction, accountId, secret)),
    teams: (token: string) => apply(token, (transaction, { accountId }) => listTeams(transaction, accountId)),
    createTeam: (token: string, name: unknown) =>
      apply(token, (transaction, { accountId }) => createTeam(transaction, accountId, name)),
    registerSigningKey: (token: string, publicKey: unknown) =>
      apply(token, (transaction, device) => registerDeviceSigningKey(transaction, device, publicKey)),
    signingKey: (token: string, deviceId: string) =>
      apply(token, (transaction, device) =>
        readDeviceSigningKey(transaction, device.accountId, identitySchema.parse(deviceId)),
      ),
    account: (token: string, selected?: string) =>
      scoped(token, selected, async (transaction, accountId, userId) => {
        const profile = await readProfile(transaction, userId);
        return {
          features: await readAccountFeatures(transaction, accountId),
          ...(profile && { profile }),
        };
      }),
    heartbeat: (token: string) =>
      apply(token, (transaction, device) => heartbeatDeviceInTransaction(transaction, device)),
    devices: (token: string) =>
      apply(token, async (transaction, device) => ({
        ...device,
        devices: await listDevices(transaction, device.accountId),
      })),
    rename: (token: string, deviceId: string, name: unknown) =>
      apply(token, async (transaction, device) => {
        const input = { accountId: device.accountId, deviceId: identitySchema.parse(deviceId) };
        return renameDeviceInTransaction(transaction, input, deviceNameSchema.parse(name));
      }),
    remove: (token: string, deviceId: string) =>
      apply(token, async (transaction, device) => {
        await removeDeviceInTransaction(transaction, {
          accountId: device.accountId,
          deviceId: identitySchema.parse(deviceId),
        });
      }),
    workbenches: (token: string, selected?: string) =>
      scoped(token, selected, (transaction, accountId, userId) => listWorkbenches(transaction, accountId, userId)),
    outstandingProjectDeletions: (token: string, selected?: string) =>
      scoped(token, selected, (transaction, accountId, userId, owner) =>
        listOutstandingProjectDeletions(transaction, accountId, owner ? undefined : userId),
      ),
    projectDeletion: (token: string, workbenchId: string, selected?: string) =>
      scoped(token, selected, async (transaction, accountId, userId) => {
        const input = { accountId, workbenchId: identitySchema.parse(workbenchId) };
        const allowed = await canManageProject(transaction, accountId, userId, input.workbenchId);
        const receipt = await readProjectDeletion(transaction, input, allowed ? undefined : userId);
        if (!allowed && !receipt) throw new DeviceAccessDenied();
        return receipt;
      }),
    startProjectDeletion: (token: string, workbenchId: string, selected?: string) =>
      scoped(token, selected, async (transaction, accountId, userId) => {
        const input = { accountId, workbenchId: identitySchema.parse(workbenchId) };
        if (
          !(await canManageProject(transaction, accountId, userId, input.workbenchId)) &&
          !(await readProjectDeletion(transaction, input, userId))
        )
          throw new DeviceAccessDenied();
        return startProjectDeletion(transaction, input, accountId === userId ? undefined : userId);
      }),
    keys: (token: string, value: string, selected?: string, expectedGrant?: string, managedHost = false) =>
      scoped(token, selected, async (transaction, accountId, userId) => {
        const workbenchId = identitySchema.parse(value);
        if (accountId !== userId) {
          const grant = await teamProjectGrant(transaction, accountId, workbenchId, userId);
          if (!grant || expectedGrant !== grant) return null;
          if (!(await admitsManagedHost(transaction, accountId, managedHost)))
            throw new TeamMembershipDenied("Update Prompt Studio to use this team's managed extensions");
        }
        return spaceKeysInTransaction(transaction, { accountId, workbenchId }, userId);
      }),
    addWorkbench: (token: string, value: string, selected?: string, grantSelf = false) =>
      scoped(token, selected, async (transaction, accountId, userId, owner) => {
        if (!owner) throw new DeviceAccessDenied();
        const workbenchId = identitySchema.parse(value);
        await requireRelay(transaction, accountId);
        const [created] = await addWorkbenchInTransaction(transaction, { accountId, workbenchId });
        if (accountId === userId) return;
        if (!created && (await teamProjectGrant(transaction, accountId, workbenchId, userId))) return;
        const newProject = created && !(await hasProjectKeyHistory(transaction, accountId, workbenchId));
        if (!newProject && !grantSelf)
          throw new TeamMembershipDenied("Grant yourself access before opening this team project");
        await transaction.insert(projectMembers).values({ accountId, workbenchId, userId });
      }),
    removeWorkbench: (token: string, workbenchId: string, selected?: string) =>
      scoped(token, selected, async (transaction, accountId, userId) => {
        const id = identitySchema.parse(workbenchId);
        if (!(await canManageProject(transaction, accountId, userId, id))) throw new DeviceAccessDenied();
        await removeWorkbenchInTransaction(transaction, { accountId, workbenchId: id });
      }),
  };
};
