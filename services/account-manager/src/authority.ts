import { and, eq, isNull, sql } from "drizzle-orm";
import { canonicalJson, identitySchema } from "pstdio-sync-contracts";
import {
  type AccountRequest,
  accountRequestSchema,
  type DeviceInput,
  type DeviceRegistrationInput,
  deviceRegistrationSchema,
  deviceSchema,
  type ProvisionInput,
  provisionSchema,
  type ReconciliationInput,
  reconciliationSchema,
  type WorkbenchInput,
  workbenchSchema,
} from "./contracts";
import { connectManager } from "./database";
import {
  addWorkbenchInTransaction,
  findDeviceAccess,
  listDevices,
  listWorkbenches,
  registerDeviceInTransaction,
  removeDeviceInTransaction,
  removeWorkbenchInTransaction,
} from "./devices";
import { captureManager, restoreManager } from "./recovery";
import { executeRequest } from "./requests";
import { accounts, devices } from "./schema";
import { rotateSpaceKeysInTransaction } from "./space-keys";
import { withAccountTransaction } from "./transactions";

export const createAccountManager = (databaseUrl: string) => {
  const connection = connectManager(databaseUrl);
  return {
    async provision(input: ProvisionInput) {
      const intent = provisionSchema.parse(input);
      const saved = await executeRequest(connection.db, intent, "provision", intent, async (transaction) => {
        await transaction
          .insert(accounts)
          .values({
            id: intent.accountId,
            ownerIssuer: intent.owner.issuer,
            ownerSubject: intent.owner.subject,
            state: "active",
          })
          .onConflictDoNothing();
        const row = (await transaction.select().from(accounts).where(eq(accounts.id, intent.accountId)))[0];
        if (canonicalJson({ issuer: row.ownerIssuer, subject: row.ownerSubject }) !== canonicalJson(intent.owner))
          throw new Error("Account identity has another owner");
        return { accountId: row.id };
      });
      return { accountId: identitySchema.parse(saved.result.accountId) };
    },
    registerDevice(input: DeviceRegistrationInput) {
      const intent = deviceRegistrationSchema.parse(input);
      return withAccountTransaction(connection.db, intent.accountId, (transaction) =>
        registerDeviceInTransaction(transaction, intent),
      );
    },
    async removeDevice(input: DeviceInput) {
      const intent = deviceSchema.parse(input);
      await withAccountTransaction(connection.db, intent.accountId, (transaction) =>
        removeDeviceInTransaction(transaction, intent),
      );
    },
    async addWorkbench(input: WorkbenchInput) {
      const intent = workbenchSchema.parse(input);
      await withAccountTransaction(connection.db, intent.accountId, (transaction) =>
        addWorkbenchInTransaction(transaction, intent),
      );
    },
    async removeWorkbench(input: WorkbenchInput) {
      const intent = workbenchSchema.parse(input);
      await withAccountTransaction(connection.db, intent.accountId, (transaction) =>
        removeWorkbenchInTransaction(transaction, intent),
      );
    },
    async disable(input: AccountRequest) {
      const intent = accountRequestSchema.parse(input);
      await executeRequest(connection.db, intent, "disable", intent, async (transaction) => {
        const rows = await transaction
          .update(accounts)
          .set({ state: "disabled" })
          .where(eq(accounts.id, intent.accountId))
          .returning({ id: accounts.id });
        if (!rows.length) throw new Error("Unknown account");
        return { accountId: intent.accountId };
      });
    },
    async reconcile(input: ReconciliationInput) {
      const intent = reconciliationSchema.parse(input);
      await executeRequest(connection.db, intent, "reconcile", intent, async (transaction) => {
        const removed = await transaction
          .update(devices)
          .set({ removedAt: sql`clock_timestamp()` })
          .where(and(eq(devices.accountId, intent.accountId), isNull(devices.removedAt)))
          .returning({ id: devices.id });
        if (removed.length) await rotateSpaceKeysInTransaction(transaction, intent.accountId);
        const rows = await transaction
          .update(accounts)
          .set({ ownerIssuer: intent.owner.issuer, ownerSubject: intent.owner.subject, state: intent.state })
          .where(eq(accounts.id, intent.accountId))
          .returning({ id: accounts.id });
        if (!rows.length) throw new Error("Unknown account");
        return { accountId: intent.accountId };
      });
    },
    snapshot: () => captureManager(connection.db),
    restore: (requestId: string, input: unknown) => restoreManager(connection.db, requestId, input),
    devices: (accountId: string) => listDevices(connection.db, identitySchema.parse(accountId)),
    workbenches: (accountId: string) => listWorkbenches(connection.db, identitySchema.parse(accountId)),
    authorize: (token: string, workbenchId: string) =>
      findDeviceAccess(connection.db, token, identitySchema.parse(workbenchId)),
    close: connection.close,
  };
};
