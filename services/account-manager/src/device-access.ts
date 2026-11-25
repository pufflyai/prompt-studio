import { and, asc, eq } from "drizzle-orm";
import { accountSignInProviderSchema, identitySchema } from "pstdio-sync-contracts";
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
import { listOutstandingProjectDeletions, readProjectDeletion, startProjectDeletion } from "./project-deletion";
import { readProviderIdentity } from "./provider-identity";
import { DeviceAccessDenied } from "./renewal-errors";
import { accounts } from "./schema";
import { spaceKeysInTransaction } from "./space-keys";
import { withAccountTransaction } from "./transactions";

type SessionReader = (headers: Headers) => Promise<{ user: { id: string } } | null>;
type Device = { accountId: string; deviceId: string };

// Logging in finds or creates the account owned by the provider identity.
export const createDeviceLogin =
  (db: ManagerDatabase, readSession: SessionReader) => async (headers: Headers, input: unknown) => {
    const { provider, ...profile } = deviceProfileSchema
      .extend({ provider: accountSignInProviderSchema.optional() })
      .parse(input);
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
      if (saved.ownerIssuer !== issuer || saved.ownerSubject !== subject) throw new DeviceAccessDenied();
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
    registerSigningKey: (token: string, publicKey: unknown) =>
      apply(token, (transaction, device) => registerDeviceSigningKey(transaction, device, publicKey)),
    signingKey: (token: string, deviceId: string) =>
      apply(token, (transaction, device) =>
        readDeviceSigningKey(transaction, device.accountId, identitySchema.parse(deviceId)),
      ),
    account: (token: string) =>
      apply(token, async (transaction, device) => ({
        features: await readAccountFeatures(transaction, device.accountId),
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
    workbenches: (token: string) =>
      apply(token, (transaction, device) => listWorkbenches(transaction, device.accountId)),
    outstandingProjectDeletions: (token: string) =>
      apply(token, (transaction, device) => listOutstandingProjectDeletions(transaction, device.accountId)),
    projectDeletion: (token: string, workbenchId: string) =>
      apply(token, (transaction, device) =>
        readProjectDeletion(transaction, {
          accountId: device.accountId,
          workbenchId: identitySchema.parse(workbenchId),
        }),
      ),
    startProjectDeletion: (token: string, workbenchId: string) =>
      apply(token, (transaction, device) =>
        startProjectDeletion(transaction, {
          accountId: device.accountId,
          workbenchId: identitySchema.parse(workbenchId),
        }),
      ),
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
        await requireRelay(transaction, device.accountId);
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
