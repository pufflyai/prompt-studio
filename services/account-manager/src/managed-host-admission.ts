import { and, eq, isNotNull } from "drizzle-orm";
import type { ManagerTransaction } from "./database";
import { teamExtensionPolicies } from "./team-managed-schema";

/** Generic/older sync clients may join ordinary teams, but cannot enforce required packages. */
export const admitsManagedHost = async (transaction: ManagerTransaction, accountId: string, supported: boolean) => {
  if (supported) return true;
  const selected = await transaction
    .select({ extensionId: teamExtensionPolicies.extensionId })
    .from(teamExtensionPolicies)
    .where(and(eq(teamExtensionPolicies.accountId, accountId), isNotNull(teamExtensionPolicies.packageId)))
    .limit(1);
  return selected.length === 0;
};
