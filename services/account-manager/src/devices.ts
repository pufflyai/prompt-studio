import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { devicePresenceLeaseMs } from "pstdio-sync-contracts";
import type { DeviceInput, DeviceRegistrationInput, WorkbenchInput } from "./contracts";
import { createCredential, digestCredential } from "./credential";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { DeviceAccessDenied } from "./renewal-errors";
import { accounts, devices, workbenches } from "./schema";
import { rotateSpaceKeysInTransaction } from "./space-keys";

type Reader = Pick<ManagerDatabase, "select">;

// Logging in again replaces the device's credential and undoes an earlier removal. The device keeps its name.
export const registerDeviceInTransaction = async (transaction: ManagerTransaction, input: DeviceRegistrationInput) => {
  const [account] = await transaction
    .select({ state: accounts.state })
    .from(accounts)
    .where(eq(accounts.id, input.accountId));
  if (account?.state !== "active") throw new DeviceAccessDenied();
  const token = createCredential();
  const digest = digestCredential(token);
  await transaction
    .insert(devices)
    .values({ accountId: input.accountId, id: input.deviceId, name: input.name, platform: input.platform, digest })
    .onConflictDoUpdate({
      target: [devices.accountId, devices.id],
      set: { platform: input.platform, digest, removedAt: null, lastSeenAt: sql`clock_timestamp()` },
    });
  return { accountId: input.accountId, deviceId: input.deviceId, token };
};

export const listDevices = async (db: Reader, accountId: string) => {
  const rows = await db
    .select({
      id: devices.id,
      name: devices.name,
      platform: devices.platform,
      createdAt: devices.createdAt,
      lastSeenAt: devices.lastSeenAt,
      online: sql<boolean>`${devices.lastSeenAt} > clock_timestamp() - ${devicePresenceLeaseMs} * interval '1 millisecond'`,
    })
    .from(devices)
    .where(and(eq(devices.accountId, accountId), isNull(devices.removedAt)))
    .orderBy(asc(devices.createdAt), asc(devices.id));
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  }));
};

export const heartbeatDeviceInTransaction = (transaction: ManagerTransaction, input: DeviceInput) =>
  transaction.update(devices).set({ lastSeenAt: sql`clock_timestamp()` }).where(activeDevice(input));

const activeDevice = (input: DeviceInput) =>
  and(eq(devices.accountId, input.accountId), eq(devices.id, input.deviceId), isNull(devices.removedAt));

export const renameDeviceInTransaction = async (transaction: ManagerTransaction, input: DeviceInput, name: string) => {
  const renamed = await transaction
    .update(devices)
    .set({ name })
    .where(activeDevice(input))
    .returning({ id: devices.id });
  return renamed.length > 0;
};

export const removeDeviceInTransaction = async (transaction: ManagerTransaction, input: DeviceInput) => {
  const removed = await transaction
    .update(devices)
    .set({ removedAt: sql`clock_timestamp()` })
    .where(activeDevice(input))
    .returning({ id: devices.id });
  if (removed.length) await rotateSpaceKeysInTransaction(transaction, input.accountId);
};

export const listWorkbenches = (db: Reader, accountId: string) =>
  db
    .select({ workbenchId: workbenches.id })
    .from(workbenches)
    .where(eq(workbenches.accountId, accountId))
    .orderBy(asc(workbenches.id));

export const addWorkbenchInTransaction = (transaction: ManagerTransaction, input: WorkbenchInput) =>
  transaction.insert(workbenches).values({ accountId: input.accountId, id: input.workbenchId }).onConflictDoNothing();

export const removeWorkbenchInTransaction = (transaction: ManagerTransaction, input: WorkbenchInput) =>
  transaction
    .delete(workbenches)
    .where(and(eq(workbenches.accountId, input.accountId), eq(workbenches.id, input.workbenchId)));

// A device reaches every cloud project of its account until it or the project is removed.
export const findDeviceAccess = async (db: Reader, token: string, workbenchId: string) => {
  const [access] = await db
    .select({ accountId: devices.accountId, workbenchId: workbenches.id, deviceId: devices.id })
    .from(devices)
    .innerJoin(accounts, eq(accounts.id, devices.accountId))
    .innerJoin(workbenches, and(eq(workbenches.accountId, devices.accountId), eq(workbenches.id, workbenchId)))
    .where(and(eq(devices.digest, digestCredential(token)), isNull(devices.removedAt), eq(accounts.state, "active")));
  return access ?? null;
};

export const findDevice = async (db: Reader, token: string) => {
  const [device] = await db
    .select({ accountId: devices.accountId, deviceId: devices.id })
    .from(devices)
    .innerJoin(accounts, eq(accounts.id, devices.accountId))
    .where(and(eq(devices.digest, digestCredential(token)), isNull(devices.removedAt), eq(accounts.state, "active")));
  return device ?? null;
};

export const accountOfCredential = async (db: Reader, token: string) => {
  const [device] = await db
    .select({ accountId: devices.accountId })
    .from(devices)
    .where(eq(devices.digest, digestCredential(token)));
  return device?.accountId ?? null;
};
