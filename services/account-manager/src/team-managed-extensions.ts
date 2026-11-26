import { and, asc, eq, notExists, sql } from "drizzle-orm";
import type {
  ManagedExtension,
  ManagedPackageDescriptor,
  ManagedPackageUpload,
  TeamExtensionPolicy,
} from "pstdio-sync-contracts";
import { requireRelay } from "./account-features";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import type { createDeviceAccess } from "./device-access";
import type { ManagedPackageObjects } from "./managed-package-objects";
import { resolveTeamCapabilities } from "./team-capabilities";
import { teamExtensionPolicies, teamManagedPackages } from "./team-managed-schema";
import { teamProjectGrant } from "./team-project-access";
import { TeamMembershipDenied } from "./teams";
import { withAccountTransaction } from "./transactions";

type TeamAccess = ReturnType<typeof createDeviceAccess>["withTeam"];
type PackageRow = typeof teamManagedPackages.$inferSelect;
type Selection = { selectionId: string; packageId: string | null };

export class ManagedPackageError extends Error {
  constructor(
    readonly status: 400 | 409 | 503,
    message: string,
  ) {
    super(message);
  }
}
const changed = () => new ManagedPackageError(409, "Team extension policy changed; reload and try again");
const unavailable = () => new ManagedPackageError(503, "Managed package storage is unavailable; try again later");
const address = (accountId: string, extensionId: string) =>
  and(eq(teamExtensionPolicies.accountId, accountId), eq(teamExtensionPolicies.extensionId, extensionId));
const metadata = (descriptor: ManagedPackageDescriptor, selectionId: string) =>
  ({
    extensionId: descriptor.extensionId,
    name: descriptor.name,
    version: descriptor.version,
    revision: descriptor.revision,
    selectionId,
  }) satisfies ManagedExtension;
const selected = async (transaction: ManagerTransaction, accountId: string, extensionId: string) => {
  const [row] = await transaction.select().from(teamExtensionPolicies).where(address(accountId, extensionId));
  return row;
};
const packageRow = async (transaction: ManagerTransaction, selection: Selection) => {
  if (!selection.packageId) throw changed();
  const [row] = await transaction
    .select()
    .from(teamManagedPackages)
    .where(eq(teamManagedPackages.id, selection.packageId));
  if (!row || row.state !== "ready") throw unavailable();
  return row;
};
const assertSelection = (current: Selection | undefined, expected: string | null) => {
  if ((current?.selectionId ?? null) !== expected) throw changed();
};

export const createTeamManagedExtensions = (
  db: ManagerDatabase,
  withTeam: TeamAccess,
  objects?: ManagedPackageObjects,
) => {
  const owner = <T>(token: string, accountId: string, action: (transaction: ManagerTransaction) => Promise<T>) =>
    withTeam(token, accountId, async (transaction, id, userId) => {
      if (!(await resolveTeamCapabilities(transaction, id, userId)).manageManagedExtensions)
        throw new TeamMembershipDenied("Only the team owner can manage required extensions");
      return action(transaction);
    });
  let occupied = 0;
  const packageSlot = async <T>(action: (storage: ManagedPackageObjects) => Promise<T>) => {
    if (!objects || occupied >= 2) throw unavailable();
    occupied++;
    try {
      return await action(objects);
    } finally {
      occupied--;
    }
  };
  const readPolicy = (token: string, accountId: string) =>
    withTeam(token, accountId, async (transaction) => {
      const rows = await transaction
        .select({ policy: teamExtensionPolicies, descriptor: teamManagedPackages.descriptor })
        .from(teamExtensionPolicies)
        .leftJoin(teamManagedPackages, eq(teamManagedPackages.id, teamExtensionPolicies.packageId))
        .where(eq(teamExtensionPolicies.accountId, accountId))
        .orderBy(asc(teamExtensionPolicies.extensionId));
      return rows.map(
        ({ policy, descriptor }) =>
          ({
            extensionId: policy.extensionId,
            selectionId: policy.selectionId,
            required: policy.packageId && descriptor ? metadata(descriptor, policy.selectionId) : null,
          }) satisfies TeamExtensionPolicy,
      );
    });
  const samePackage = async (
    transaction: ManagerTransaction,
    current: Selection | undefined,
    input: ManagedPackageDescriptor,
  ) => {
    if (!current?.packageId) return;
    const { descriptor } = await packageRow(transaction, current);
    if (
      descriptor.revision === input.revision &&
      descriptor.version === input.version &&
      descriptor.name === input.name
    )
      return metadata(descriptor, current.selectionId);
  };
  const upload = (
    token: string,
    accountId: string,
    input: ManagedPackageUpload,
    readBytes: () => Promise<Uint8Array>,
  ) =>
    packageSlot(async (storage) => {
      const current = await owner(token, accountId, async (transaction) => {
        const current = await selected(transaction, accountId, input.extensionId);
        const same = await samePackage(transaction, current, input);
        if (same) return same;
        assertSelection(current, input.expectedSelection);
      });
      if (current) return current;
      const bytes = await readBytes();
      if (
        bytes.length !== input.byteLength ||
        new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== input.cipherSha256
      )
        throw new ManagedPackageError(400, "Managed package bytes do not match their descriptor");
      const id = crypto.randomUUID();
      const { expectedSelection, ...descriptor } = input;
      await owner(token, accountId, async (transaction) => {
        assertSelection(await selected(transaction, accountId, input.extensionId), expectedSelection);
        await transaction.insert(teamManagedPackages).values({ id, accountId, descriptor, state: "uploading" });
      });
      const uploadId = await storage.reserve(id);
      await db.update(teamManagedPackages).set({ uploadId }).where(eq(teamManagedPackages.id, id));
      await storage.write(id, uploadId, bytes);
      return owner(token, accountId, async (transaction) => {
        const current = await selected(transaction, accountId, input.extensionId);
        const same = await samePackage(transaction, current, descriptor);
        await transaction.update(teamManagedPackages).set({ state: "ready" }).where(eq(teamManagedPackages.id, id));
        if (same) return same;
        assertSelection(current, expectedSelection);
        const selectionId = crypto.randomUUID();
        await transaction
          .insert(teamExtensionPolicies)
          .values({ accountId, extensionId: input.extensionId, selectionId, packageId: id })
          .onConflictDoUpdate({
            target: [teamExtensionPolicies.accountId, teamExtensionPolicies.extensionId],
            set: { selectionId, packageId: id },
          });
        return metadata(descriptor, selectionId);
      });
    });
  const authorizedPackage = (
    token: string,
    accountId: string,
    extensionId: string,
    input: { workbenchId: string; grantId: string; selectionId: string },
  ) =>
    withTeam(token, accountId, async (transaction, id, userId) => {
      await requireRelay(transaction, id);
      if ((await teamProjectGrant(transaction, id, input.workbenchId, userId)) !== input.grantId)
        throw new TeamMembershipDenied("Current project access is required to download managed packages");
      const current = await selected(transaction, id, extensionId);
      if (!current || current.selectionId !== input.selectionId) throw changed();
      return packageRow(transaction, current);
    });
  const download = async (...args: Parameters<typeof authorizedPackage>) => {
    const before = await authorizedPackage(...args);
    return packageSlot(async (storage) => {
      const bytes = await storage.read(before.id);
      if (
        bytes.length !== before.descriptor.byteLength ||
        new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== before.descriptor.cipherSha256
      )
        throw unavailable();
      if ((await authorizedPackage(...args)).id !== before.id) throw changed();
      return { descriptor: before.descriptor, bytes };
    });
  };
  const remove = (token: string, accountId: string, extensionId: string, expected: string) =>
    owner(token, accountId, async (transaction) => {
      const current = await selected(transaction, accountId, extensionId);
      assertSelection(current, expected);
      await transaction
        .update(teamExtensionPolicies)
        .set({ selectionId: crypto.randomUUID(), packageId: null })
        .where(address(accountId, extensionId));
      return { ok: true };
    });
  const unused = (row: Pick<PackageRow, "id">) =>
    notExists(db.select().from(teamExtensionPolicies).where(eq(teamExtensionPolicies.packageId, row.id)));
  const expired = sql`((${teamManagedPackages.state} = 'uploading' and ${teamManagedPackages.createdAt} < clock_timestamp() - interval '1 hour')
    or (${teamManagedPackages.state} = 'ready' and ${teamManagedPackages.createdAt} < clock_timestamp() - interval '7 days'))`;
  const cleanup = async () => {
    if (!objects) return;
    const rows = await db
      .select({ id: teamManagedPackages.id, accountId: teamManagedPackages.accountId })
      .from(teamManagedPackages)
      .where(
        and(
          expired,
          notExists(
            db.select().from(teamExtensionPolicies).where(eq(teamExtensionPolicies.packageId, teamManagedPackages.id)),
          ),
        ),
      )
      .orderBy(asc(teamManagedPackages.createdAt))
      .limit(25);
    for (const row of rows)
      await withAccountTransaction(db, row.accountId, async (transaction) => {
        const [stillUnused] = await transaction
          .select()
          .from(teamManagedPackages)
          .where(and(eq(teamManagedPackages.id, row.id), expired, unused(row)));
        if (!stillUnused) return;
        await objects.remove(row.id);
        await transaction.delete(teamManagedPackages).where(eq(teamManagedPackages.id, row.id));
      });
  };
  let cleaning: Promise<void> | undefined;
  const tick = () => {
    cleaning ??= cleanup()
      .catch(() => {
        console.warn(JSON.stringify({ event: "managed_packages.cleanup_failed" }));
      })
      .finally(() => {
        cleaning = undefined;
      });
  };
  const timer = objects ? setInterval(tick, 60 * 60_000).unref() : undefined;
  if (objects) tick();
  return {
    readPolicy,
    upload,
    download,
    remove,
    cleanup,
    list: async (token: string, accountId: string) =>
      (await readPolicy(token, accountId)).flatMap(({ required }) => (required ? [required] : [])),
    close: async () => {
      clearInterval(timer);
      await cleaning;
      objects?.close();
    },
  };
};
