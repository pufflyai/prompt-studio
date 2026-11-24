import { and, asc, eq } from "drizzle-orm";
import { identitySchema } from "pstdio-sync-contracts";
import { readAccountFeatures, requireRelay } from "./account-features";
import { account } from "./auth-schema";
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
import { listOutstandingProjectDeletions, readProjectDeletion, startProjectDeletion } from "./project-deletion";
import { DeviceAccessDenied } from "./renewal-errors";
import { accounts, projectMembers } from "./schema";
import { spaceKeysInTransaction } from "./space-keys";
import { createTeam, listTeams, requireTeamMember } from "./teams";
import { lockAccount, withAccountTransaction } from "./transactions";

const googleIssuer = "https://accounts.google.com";
type SessionReader = (headers: Headers) => Promise<{ user: { id: string } } | null>;
type Device = { accountId: string; deviceId: string };

// Logging in is the only step that needs a Google session. It finds or creates the user's account.
export const createDeviceLogin =
  (db: ManagerDatabase, readSession: SessionReader) => async (headers: Headers, input: unknown) => {
    const profile = deviceProfileSchema.parse(input);
    const session = await readSession(headers);
    if (!session) throw new DeviceAccessDenied();
    const [provider] = await db
      .select({ subject: account.accountId })
      .from(account)
      .where(and(eq(account.userId, session.user.id), eq(account.providerId, "google")));
    if (!provider) throw new DeviceAccessDenied();
    // A Google user has one account: the one they already own, or a new one whose ID comes from their identity.
    const [owned] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.ownerIssuer, googleIssuer), eq(accounts.ownerSubject, provider.subject)))
      .orderBy(asc(accounts.id))
      .limit(1);
    const accountId = owned?.id ?? digestCredential(`${googleIssuer}\n${provider.subject}`);
    return withAccountTransaction(db, accountId, async (transaction) => {
      await transaction
        .insert(accounts)
        .values({ id: accountId, ownerIssuer: googleIssuer, ownerSubject: provider.subject, state: "active" })
        .onConflictDoNothing();
      const [saved] = await transaction.select().from(accounts).where(eq(accounts.id, accountId));
      if (saved.ownerIssuer !== googleIssuer || saved.ownerSubject !== provider.subject) throw new DeviceAccessDenied();
      return registerDeviceInTransaction(transaction, { accountId, ...profile });
    });
  };

// Every other request carries the device credential. Devices of one account manage each other.
export const createDeviceAccess = (db: ManagerDatabase) => {
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

  return {
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
      scoped(token, selected, async (transaction, accountId) => ({
        features: await readAccountFeatures(transaction, accountId),
      })),
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
      scoped(token, selected, async (transaction, accountId, _userId, owner) => {
        if (!owner) return [];
        return listOutstandingProjectDeletions(transaction, accountId);
      }),
    projectDeletion: (token: string, workbenchId: string, selected?: string) =>
      scoped(token, selected, async (transaction, accountId, _userId, owner) => {
        if (!owner) throw new DeviceAccessDenied();
        return readProjectDeletion(transaction, { accountId, workbenchId: identitySchema.parse(workbenchId) });
      }),
    startProjectDeletion: (token: string, workbenchId: string, selected?: string) =>
      scoped(token, selected, async (transaction, accountId, _userId, owner) => {
        if (!owner) throw new DeviceAccessDenied();
        return startProjectDeletion(transaction, { accountId, workbenchId: identitySchema.parse(workbenchId) });
      }),
    keys: (token: string, value: string, selected?: string) =>
      scoped(token, selected, async (transaction, accountId, userId) => {
        const workbenchId = identitySchema.parse(value);
        if (accountId !== userId) {
          const [grant] = await transaction
            .select({ userId: projectMembers.userId })
            .from(projectMembers)
            .where(
              and(
                eq(projectMembers.accountId, accountId),
                eq(projectMembers.workbenchId, workbenchId),
                eq(projectMembers.userId, userId),
              ),
            );
          if (!grant) return null;
        }
        return spaceKeysInTransaction(transaction, { accountId, workbenchId }, userId);
      }),
    addWorkbench: (token: string, value: string, selected?: string) =>
      scoped(token, selected, async (transaction, accountId, userId, owner) => {
        if (!owner) throw new DeviceAccessDenied();
        const workbenchId = identitySchema.parse(value);
        await requireRelay(transaction, accountId);
        await addWorkbenchInTransaction(transaction, { accountId, workbenchId });
        if (accountId !== userId)
          await transaction.insert(projectMembers).values({ accountId, workbenchId, userId }).onConflictDoNothing();
      }),
    removeWorkbench: (token: string, workbenchId: string, selected?: string) =>
      scoped(token, selected, async (transaction, accountId, _userId, owner) => {
        if (!owner) throw new DeviceAccessDenied();
        await removeWorkbenchInTransaction(transaction, { accountId, workbenchId: identitySchema.parse(workbenchId) });
      }),
  };
};
