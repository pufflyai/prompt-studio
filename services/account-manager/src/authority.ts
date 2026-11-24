import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { canonicalJson, identitySchema } from "pstdio-sync-contracts";
import type { z } from "zod";
import { setAccountFeatureInTransaction } from "./account-features";
import {
  type AccountRequest,
  accountFeatureSchema,
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
import { connectManager, type ManagerTransaction } from "./database";
import {
  addWorkbenchInTransaction,
  findDeviceAccess,
  listDevices,
  listWorkbenches,
  registerDeviceInTransaction,
  removeDeviceInTransaction,
  removeWorkbenchInTransaction,
  rotateRemovedDeviceKeys,
} from "./devices";
import { captureManager, restoreManager } from "./recovery";
import { executeRequest } from "./requests";
import { accounts, devices } from "./schema";
import { hasTeamIdentity } from "./teams";
import { withAccountTransaction } from "./transactions";

const reconcilePersonalAccount = async (
  transaction: ManagerTransaction,
  intent: ReconciliationInput,
  account: typeof accounts.$inferSelect,
) => {
  if (!intent.owner) throw new Error("A personal account requires its verified owner");
  const ownerChanged = account.ownerIssuer !== intent.owner.issuer || account.ownerSubject !== intent.owner.subject;
  if (ownerChanged && (await hasTeamIdentity(transaction, intent.accountId)))
    throw new Error("A person with team authority or private team keys must keep their verified Google identity");
  const removed = await transaction
    .update(devices)
    .set({ removedAt: sql`clock_timestamp()` })
    .where(and(eq(devices.accountId, intent.accountId), isNull(devices.removedAt)))
    .returning({ id: devices.id });
  if (removed.length) await rotateRemovedDeviceKeys(transaction, intent.accountId);
  const rows = await transaction
    .update(accounts)
    .set({ ownerIssuer: intent.owner.issuer, ownerSubject: intent.owner.subject, state: intent.state })
    .where(and(eq(accounts.id, intent.accountId), isNotNull(accounts.ownerIssuer)))
    .returning({ id: accounts.id });
  if (!rows.length) throw new Error("Unknown account");
};

export const createAccountManager = (databaseUrl: string) => {
  const connection = connectManager(databaseUrl);
  return {
    setFeature(input: z.infer<typeof accountFeatureSchema>) {
      const intent = accountFeatureSchema.parse(input);
      return withAccountTransaction(connection.db, intent.accountId, (transaction) =>
        setAccountFeatureInTransaction(transaction, intent),
      );
    },
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
        const [account] = await transaction.select().from(accounts).where(eq(accounts.id, intent.accountId));
        if (!account) throw new Error("Unknown account");
        if (account.ownerIssuer === null) {
          if (intent.owner) throw new Error("Team ownership is managed by its members");
          await transaction.update(accounts).set({ state: intent.state }).where(eq(accounts.id, intent.accountId));
          return { accountId: intent.accountId };
        }
        await reconcilePersonalAccount(transaction, intent, account);
        return { accountId: intent.accountId };
      });
    },
    snapshot: () => captureManager(connection.db),
    restore: (requestId: string, input: unknown) => restoreManager(connection.db, requestId, input),
    devices: (accountId: string) => listDevices(connection.db, identitySchema.parse(accountId)),
    workbenches: (accountId: string) => listWorkbenches(connection.db, identitySchema.parse(accountId)),
    async authorize(token: string, workbenchId: string) {
      const access = await findDeviceAccess(connection.db, token, identitySchema.parse(workbenchId));
      if (!access) return null;
      const { userId: _userId, ...personal } = access;
      return personal;
    },
    close: connection.close,
  };
};
