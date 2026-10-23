import { and, asc, eq, max } from "drizzle-orm";
import type { SpaceKeys } from "pstdio-sync-contracts";
import { readAccountFeatures } from "./account-features";
import type { WorkbenchInput } from "./contracts";
import type { ManagerTransaction } from "./database";
import { spaceKeys, workbenches } from "./schema";

const spaces = ["project", "personal"] as const;
const createSecret = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

// A removed device keeps the keys it already has, so only data sealed with the next generation is closed to it.
export const rotateSpaceKeysInTransaction = async (transaction: ManagerTransaction, accountId: string) => {
  const latest = await transaction
    .select({ workbenchId: spaceKeys.workbenchId, space: spaceKeys.space, generation: max(spaceKeys.generation) })
    .from(spaceKeys)
    .where(eq(spaceKeys.accountId, accountId))
    .groupBy(spaceKeys.workbenchId, spaceKeys.space);
  if (!latest.length) return;
  await transaction.insert(spaceKeys).values(
    latest.map((row) => ({
      accountId,
      workbenchId: row.workbenchId,
      space: row.space,
      generation: (row.generation ?? 0) + 1,
      secret: createSecret(),
    })),
  );
};

/**
 * The keys of a cloud project, or null when the account has no such project. The first request
 * creates generation 1, so every cloud project gets keys in one place, whenever it became one.
 */
export const spaceKeysInTransaction = async (
  transaction: ManagerTransaction,
  input: WorkbenchInput,
): Promise<SpaceKeys | null> => {
  if (!(await readAccountFeatures(transaction, input.accountId)).relay) return null;
  const [workbench] = await transaction
    .select({ id: workbenches.id })
    .from(workbenches)
    .where(and(eq(workbenches.accountId, input.accountId), eq(workbenches.id, input.workbenchId)));
  if (!workbench) return null;
  // Keys outlive a workbench removal, so a project that syncs again keeps reading its relay data.
  await transaction
    .insert(spaceKeys)
    .values(spaces.map((space) => ({ ...input, space, generation: 1, secret: createSecret() })))
    .onConflictDoNothing();
  const rows = await transaction
    .select({ space: spaceKeys.space, generation: spaceKeys.generation, secret: spaceKeys.secret })
    .from(spaceKeys)
    .where(and(eq(spaceKeys.accountId, input.accountId), eq(spaceKeys.workbenchId, input.workbenchId)))
    .orderBy(asc(spaceKeys.generation));
  const of = (space: (typeof spaces)[number]) =>
    rows.filter((row) => row.space === space).map(({ generation, secret }) => ({ generation, secret }));
  return { project: of("project"), personal: of("personal") };
};
