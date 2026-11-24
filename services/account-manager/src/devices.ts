import { and, asc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { devicePresenceLeaseMs } from "pstdio-sync-contracts";
import { relayEnabled } from "./account-features";
import type { DeviceInput, DeviceRegistrationInput, WorkbenchInput } from "./contracts";
import { createCredential, digestCredential } from "./credential";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { assertProjectCanSync } from "./project-deletion";
import { DeviceAccessDenied } from "./renewal-errors";
import { accounts, devices, spaceKeys, workbenches } from "./schema";
import { rotateSpaceKeysInTransaction } from "./space-keys";
import { canUseTeamProject } from "./teams";
import { lockAccount } from "./transactions";

type Reader = Pick<ManagerDatabase, "select">;

// Logging in again replaces the device's credential and undoes an earlier removal. The device keeps its name.
export const registerDeviceInTransaction = async (transaction: ManagerTransaction, input: DeviceRegistrationInput) => {
  const [account] = await transaction
    .select({ state: accounts.state })
    .from(accounts)
    .where(and(eq(accounts.id, input.accountId), isNotNull(accounts.ownerIssuer)));
  if (account?.state !== "active") throw new DeviceAccessDenied();
  const token = createCredential();
  const digest = digestCredential(token);
  await transaction
    .insert(devices)
    .values({ accountId: input.accountId, id: input.deviceId, name: input.name, platform: input.platform, digest })
    .onConflictDoUpdate({
      target: [devices.accountId, devices.id],
      set: { platform: input.platform, digest, signingKey: null, removedAt: null, lastSeenAt: sql`clock_timestamp()` },
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
    .set({ removedAt: sql`clock_timestamp()`, signingKey: null })
    .where(activeDevice(input))
    .returning({ id: devices.id });
  if (removed.length) await rotateRemovedDeviceKeys(transaction, input.accountId);
};

export const rotateRemovedDeviceKeys = async (transaction: ManagerTransaction, userId: string) => {
  await rotateSpaceKeysInTransaction(transaction, userId);
  const keyAccounts = await transaction
    .selectDistinct({ accountId: spaceKeys.accountId })
    .from(spaceKeys)
    .where(eq(spaceKeys.ownerId, userId))
    .orderBy(asc(spaceKeys.accountId));
  for (const { accountId } of keyAccounts) {
    await lockAccount(transaction, accountId);
    await rotateSpaceKeysInTransaction(transaction, accountId, userId);
  }
};

export const listWorkbenches = (db: Reader, accountId: string, userId = accountId) =>
  db
    .select({ workbenchId: workbenches.id })
    .from(workbenches)
    .where(
      and(
        eq(workbenches.accountId, accountId),
        relayEnabled(db, accountId),
        userId === accountId ? undefined : canUseTeamProject(db, accountId, workbenches.id, userId),
      ),
    )
    .orderBy(asc(workbenches.id));

export const addWorkbenchInTransaction = async (transaction: ManagerTransaction, input: WorkbenchInput) => {
  await assertProjectCanSync(transaction, input);
  return transaction
    .insert(workbenches)
    .values({ accountId: input.accountId, id: input.workbenchId })
    .onConflictDoNothing()
    .returning({ id: workbenches.id });
};

export const removeWorkbenchInTransaction = (transaction: ManagerTransaction, input: WorkbenchInput) =>
  transaction
    .delete(workbenches)
    .where(and(eq(workbenches.accountId, input.accountId), eq(workbenches.id, input.workbenchId)));

export const findDeviceAccess = async (db: Reader, token: string, workbenchId: string, accountId?: string) => {
  const projectAccount = accountId ?? devices.accountId;
  const [access] = await db
    .select({
      accountId: workbenches.accountId,
      userId: devices.accountId,
      workbenchId: workbenches.id,
      deviceId: devices.id,
    })
    .from(devices)
    .innerJoin(accounts, eq(accounts.id, devices.accountId))
    .innerJoin(workbenches, and(eq(workbenches.accountId, projectAccount), eq(workbenches.id, workbenchId)))
    .where(
      and(
        eq(devices.digest, digestCredential(token)),
        isNull(devices.removedAt),
        eq(accounts.state, "active"),
        relayEnabled(db, workbenches.accountId),
        or(
          eq(workbenches.accountId, devices.accountId),
          canUseTeamProject(db, workbenches.accountId, workbenches.id, devices.accountId),
        ),
      ),
    );
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
