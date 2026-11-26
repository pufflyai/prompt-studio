import { and, eq } from "drizzle-orm";
import { deriveDocumentNamingKey, publicationDocumentNames, syncDocumentId } from "pstdio-sync-contracts";
import type { ManagerTransaction } from "./database";
import { findDeviceAccess } from "./devices";
import { EnvironmentAccessDenied } from "./renewal-errors";
import { spaceKeys } from "./schema";
import { spaceKeysInTransaction } from "./space-keys";
import { resolveTeamCapabilities } from "./team-capabilities";
import { lockAccount, withAccountTransaction } from "./transactions";

type DeviceAccess = NonNullable<Awaited<ReturnType<typeof findDeviceAccess>>>;
type Database = Parameters<typeof withAccountTransaction>[0];

export const canPublishForTeam = async (transaction: ManagerTransaction, access: DeviceAccess) => {
  const capabilities = await resolveTeamCapabilities(transaction, access.accountId, access.userId, access.workbenchId);
  return capabilities.publishProjectExtensions;
};

export const sameDeviceAccess = (expected: DeviceAccess, current: DeviceAccess | null): current is DeviceAccess =>
  current !== null &&
  current.accountId === expected.accountId &&
  current.userId === expected.userId &&
  current.deviceId === expected.deviceId &&
  current.workbenchId === expected.workbenchId &&
  current.grantId === expected.grantId;

export const prepareTeamPublicationGrant = async (db: Database, access: DeviceAccess, token: string) => {
  const { accountId, workbenchId, userId } = access;
  if (accountId === userId) return undefined;
  const { secret, canWrite } = await withAccountTransaction(db, userId, async (transaction) => {
    await lockAccount(transaction, accountId);
    const current = await findDeviceAccess(transaction, token, workbenchId, accountId);
    if (!sameDeviceAccess(access, current)) throw new EnvironmentAccessDenied();
    const [first] = await transaction
      .select({ secret: spaceKeys.secret })
      .from(spaceKeys)
      .where(
        and(
          eq(spaceKeys.accountId, accountId),
          eq(spaceKeys.workbenchId, workbenchId),
          eq(spaceKeys.space, "project"),
          eq(spaceKeys.ownerId, ""),
          eq(spaceKeys.generation, 1),
        ),
      );
    const secret =
      first?.secret ??
      (await spaceKeysInTransaction(transaction, { accountId, workbenchId }, userId))?.project[0]?.secret;
    if (!secret) throw new EnvironmentAccessDenied();
    return { secret, canWrite: await canPublishForTeam(transaction, current) };
  });
  const namingKey = await deriveDocumentNamingKey(secret);
  const documents = await Promise.all([
    syncDocumentId(namingKey, publicationDocumentNames[0]),
    syncDocumentId(namingKey, publicationDocumentNames[1]),
  ]);
  return { documents, canWrite };
};
