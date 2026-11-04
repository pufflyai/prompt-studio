import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { requireRelay } from "./account-features";
import { verification } from "./auth-schema";
import { deviceProfileSchema } from "./contracts";
import { createCredential, digestCredential } from "./credential";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { accountOfCredential, findDevice } from "./devices";
import { DeviceAccessDenied } from "./renewal-errors";
import { accounts, devices } from "./schema";
import { withAccountTransaction } from "./transactions";

const grantProfile = deviceProfileSchema.extend({
  accountId: identitySchema,
  sponsorId: identitySchema,
  sponsorDigest: z.string(),
});
const enrollment = z.strictObject({ deviceId: identitySchema, token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
const grantId = (token: string) => `cloud-enrollment:${digestCredential(token)}`;
const unusedIdentity = async (db: ManagerTransaction, accountId: string, deviceId: string) => {
  const [known] = await db
    .select({ id: devices.id })
    .from(devices)
    .where(and(eq(devices.accountId, accountId), eq(devices.id, deviceId)));
  if (known) throw new DeviceAccessDenied();
};

// A grant delegates exactly one new identity; it is not an account session or a device credential.
export const createDeviceEnrollment = (db: ManagerDatabase) => ({
  async issue(token: string, input: unknown) {
    const profile = deviceProfileSchema.parse(input);
    const accountId = await accountOfCredential(db, token);
    if (!accountId) throw new DeviceAccessDenied();
    return withAccountTransaction(db, accountId, async (transaction) => {
      const sponsor = await findDevice(transaction, token);
      if (!sponsor) throw new DeviceAccessDenied();
      await requireRelay(transaction, accountId);
      await unusedIdentity(transaction, accountId, profile.deviceId);
      const grant = createCredential();
      const [saved] = await transaction
        .insert(verification)
        .values({
          id: grantId(grant),
          identifier: `pstdio-cloud-enrollment:${accountId}`,
          value: JSON.stringify({
            ...profile,
            accountId,
            sponsorId: sponsor.deviceId,
            sponsorDigest: digestCredential(token),
          }),
          expiresAt: sql`clock_timestamp() + interval '15 minutes'`,
          createdAt: sql`clock_timestamp()`,
          updatedAt: sql`clock_timestamp()`,
        })
        .returning({ expiresAt: verification.expiresAt });
      return { grant, expiresAt: saved.expiresAt.toISOString() };
    });
  },
  async consume(grant: string, input: unknown) {
    const target = enrollment.parse(input);
    const id = grantId(grant);
    const [candidate] = await db.select().from(verification).where(eq(verification.id, id));
    if (!candidate) throw new DeviceAccessDenied();
    const scope = grantProfile.parse(JSON.parse(candidate.value));
    return withAccountTransaction(db, scope.accountId, async (transaction) => {
      const [saved] = await transaction
        .delete(verification)
        .where(and(eq(verification.id, id), gt(verification.expiresAt, sql`clock_timestamp()`)))
        .returning();
      if (!saved || target.deviceId !== scope.deviceId) throw new DeviceAccessDenied();
      const [sponsor] = await transaction
        .select({ id: devices.id })
        .from(devices)
        .innerJoin(accounts, eq(accounts.id, devices.accountId))
        .where(
          and(
            eq(devices.accountId, scope.accountId),
            eq(devices.id, scope.sponsorId),
            eq(devices.digest, scope.sponsorDigest),
            isNull(devices.removedAt),
            eq(accounts.state, "active"),
          ),
        );
      if (!sponsor || digestCredential(target.token) === scope.sponsorDigest) throw new DeviceAccessDenied();
      await requireRelay(transaction, scope.accountId);
      await unusedIdentity(transaction, scope.accountId, target.deviceId);
      await transaction.insert(devices).values({
        accountId: scope.accountId,
        id: scope.deviceId,
        name: scope.name,
        platform: scope.platform,
        digest: digestCredential(target.token),
      });
      return { accountId: scope.accountId, deviceId: scope.deviceId };
    });
  },
});
