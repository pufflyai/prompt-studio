import { and, asc, eq } from "drizzle-orm";
import { identitySchema } from "pstdio-sync-contracts";
import { account } from "./auth-schema";
import { deviceNameSchema, deviceProfileSchema } from "./contracts";
import { digestCredential } from "./credential";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import {
  accountOfCredential,
  addWorkbenchInTransaction,
  findDevice,
  listDevices,
  listWorkbenches,
  registerDeviceInTransaction,
  removeDeviceInTransaction,
  removeWorkbenchInTransaction,
  renameDeviceInTransaction,
} from "./devices";
import { DeviceAccessDenied } from "./renewal-errors";
import { accounts } from "./schema";
import { spaceKeysInTransaction } from "./space-keys";
import { withAccountTransaction } from "./transactions";

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
  return {
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
    workbenches: (token: string) =>
      apply(token, (transaction, device) => listWorkbenches(transaction, device.accountId)),
    /** The keys of a cloud project, or null when the account has no such project. */
    keys: (token: string, workbenchId: string) =>
      apply(token, (transaction, device) =>
        spaceKeysInTransaction(transaction, {
          accountId: device.accountId,
          workbenchId: identitySchema.parse(workbenchId),
        }),
      ),
    addWorkbench: (token: string, workbenchId: string) =>
      apply(token, async (transaction, device) => {
        await addWorkbenchInTransaction(transaction, {
          accountId: device.accountId,
          workbenchId: identitySchema.parse(workbenchId),
        });
      }),
    removeWorkbench: (token: string, workbenchId: string) =>
      apply(token, async (transaction, device) => {
        await removeWorkbenchInTransaction(transaction, {
          accountId: device.accountId,
          workbenchId: identitySchema.parse(workbenchId),
        });
      }),
  };
};
