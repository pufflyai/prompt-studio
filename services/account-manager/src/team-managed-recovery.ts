import { asc, eq } from "drizzle-orm";
import { canonicalJson, identitySchema, managedPackageDescriptorSchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { ManagerTransaction } from "./database";
import { teamExtensionPolicies, teamManagedPackages } from "./team-managed-schema";

export const managedSnapshotShape = {
  managedPackages: z
    .array(
      z.strictObject({
        id: identitySchema,
        accountId: identitySchema,
        descriptor: managedPackageDescriptorSchema,
        createdAt: z.iso.datetime(),
      }),
    )
    .optional(),
  managedPolicies: z
    .array(
      z.strictObject({
        accountId: identitySchema,
        extensionId: managedPackageDescriptorSchema.shape.extensionId,
        selectionId: identitySchema,
        packageId: identitySchema.nullable(),
      }),
    )
    .optional(),
};
type ManagedSnapshot = z.infer<z.ZodObject<typeof managedSnapshotShape>>;
export const validateManagedSnapshot = (
  snapshot: ManagedSnapshot,
  teamIds: Set<string>,
  invalid: (path: (string | number)[], message: string) => void,
) => {
  const packages = new Map((snapshot.managedPackages ?? []).map((row) => [row.id, row]));
  if (packages.size !== (snapshot.managedPackages ?? []).length)
    invalid(["managedPackages"], "Duplicate managed package identity");
  for (const [index, row] of (snapshot.managedPackages ?? []).entries())
    if (!teamIds.has(row.accountId)) invalid(["managedPackages", index], "Unknown managed package team");
  const policies = new Set<string>();
  for (const [index, row] of (snapshot.managedPolicies ?? []).entries()) {
    const key = canonicalJson([row.accountId, row.extensionId]);
    if (policies.has(key)) invalid(["managedPolicies", index], "Duplicate team extension policy");
    policies.add(key);
    if (!teamIds.has(row.accountId)) invalid(["managedPolicies", index], "Unknown policy team");
    const pkg = row.packageId ? packages.get(row.packageId) : undefined;
    if (row.packageId && (!pkg || pkg.accountId !== row.accountId || pkg.descriptor.extensionId !== row.extensionId))
      invalid(["managedPolicies", index], "Managed package belongs to another policy");
  }
};
export const captureManagedPackages = async (transaction: ManagerTransaction) => {
  const packages = await transaction
    .select()
    .from(teamManagedPackages)
    .where(eq(teamManagedPackages.state, "ready"))
    .orderBy(asc(teamManagedPackages.id));
  const policies = await transaction
    .select()
    .from(teamExtensionPolicies)
    .orderBy(asc(teamExtensionPolicies.accountId), asc(teamExtensionPolicies.extensionId));
  return {
    ...(packages.length
      ? {
          managedPackages: packages.map(({ id, accountId, descriptor, createdAt }) => ({
            id,
            accountId,
            descriptor,
            createdAt: createdAt.toISOString(),
          })),
        }
      : {}),
    ...(policies.length ? { managedPolicies: policies } : {}),
  };
};
export const assertManagedSnapshotFits = async (transaction: ManagerTransaction, snapshot: ManagedSnapshot) => {
  for (const incoming of snapshot.managedPackages ?? []) {
    const [known] = await transaction.select().from(teamManagedPackages).where(eq(teamManagedPackages.id, incoming.id));
    if (
      known &&
      (known.accountId !== incoming.accountId || canonicalJson(known.descriptor) !== canonicalJson(incoming.descriptor))
    )
      throw new Error("Manager snapshot conflicts with a managed package key or object");
  }
};
export const restoreManagedPackages = async (
  transaction: ManagerTransaction,
  snapshot: ManagedSnapshot,
  newTeams: Set<string>,
) => {
  const packages = (snapshot.managedPackages ?? []).filter(({ accountId }) => newTeams.has(accountId));
  for (let offset = 0; offset < packages.length; offset += 1000)
    await transaction
      .insert(teamManagedPackages)
      .values(
        packages.slice(offset, offset + 1000).map((row) => ({
          ...row,
          createdAt: new Date(row.createdAt),
          state: "ready" as const,
        })),
      )
      .onConflictDoNothing();
  const policies = (snapshot.managedPolicies ?? []).filter(({ accountId }) => newTeams.has(accountId));
  for (let offset = 0; offset < policies.length; offset += 1000)
    await transaction
      .insert(teamExtensionPolicies)
      .values(policies.slice(offset, offset + 1000))
      .onConflictDoNothing();
};
