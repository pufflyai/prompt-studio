import { and, asc, eq, exists, inArray, max, notExists, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { SpaceKeys } from "pstdio-sync-contracts";
import { readAccountFeatures } from "./account-features";
import type { WorkbenchInput } from "./contracts";
import type { ManagerTransaction } from "./database";
import { projectDeletions, spaceKeys, workbenches } from "./schema";

const spaces = ["project", "personal"] as const;
const createSecret = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

const rotateMatchingKeys = async (transaction: ManagerTransaction, accountId: string, filter?: SQL) => {
  const latest = await transaction
    .select({
      workbenchId: spaceKeys.workbenchId,
      space: spaceKeys.space,
      ownerId: spaceKeys.ownerId,
      generation: max(spaceKeys.generation),
    })
    .from(spaceKeys)
    .where(
      and(
        eq(spaceKeys.accountId, accountId),
        filter,
        notExists(
          transaction
            .select()
            .from(projectDeletions)
            .where(
              and(
                eq(projectDeletions.accountId, spaceKeys.accountId),
                eq(projectDeletions.workbenchId, spaceKeys.workbenchId),
              ),
            ),
        ),
      ),
    )
    .groupBy(spaceKeys.workbenchId, spaceKeys.space, spaceKeys.ownerId);
  if (!latest.length) return;
  await transaction.insert(spaceKeys).values(
    latest.map((row) => ({
      accountId,
      workbenchId: row.workbenchId,
      space: row.space,
      ownerId: row.ownerId,
      generation: (row.generation ?? 0) + 1,
      secret: createSecret(),
    })),
  );
};

// A removed device keeps the keys it already has, so only data sealed with the next generation is closed to it.
export const rotateSpaceKeysInTransaction = async (
  transaction: ManagerTransaction,
  accountId: string,
  userId = accountId,
) => {
  const ownerId = userId === accountId ? "" : userId;
  const acknowledged = alias(spaceKeys, "issued_private_keys");
  await rotateMatchingKeys(
    transaction,
    accountId,
    and(
      or(eq(spaceKeys.space, "project"), eq(spaceKeys.ownerId, ownerId)),
      userId === accountId
        ? undefined
        : exists(
            transaction
              .select({ ownerId: acknowledged.ownerId })
              .from(acknowledged)
              .where(
                and(
                  eq(acknowledged.accountId, spaceKeys.accountId),
                  eq(acknowledged.workbenchId, spaceKeys.workbenchId),
                  eq(acknowledged.ownerId, ownerId),
                ),
              ),
          ),
    ),
  );
};

export const rotateProjectSharedKeys = (transaction: ManagerTransaction, accountId: string, workbenchIds: string[]) =>
  rotateMatchingKeys(
    transaction,
    accountId,
    and(eq(spaceKeys.space, "project"), inArray(spaceKeys.workbenchId, workbenchIds)),
  );

/**
 * The keys of a cloud project, or null when the account has no such project. The first request
 * creates generation 1, so every cloud project gets keys in one place, whenever it became one.
 */
export const spaceKeysInTransaction = async (
  transaction: ManagerTransaction,
  input: WorkbenchInput,
  userId = input.accountId,
): Promise<SpaceKeys | null> => {
  if (!(await readAccountFeatures(transaction, input.accountId)).relay) return null;
  const [workbench] = await transaction
    .select({ id: workbenches.id })
    .from(workbenches)
    .where(and(eq(workbenches.accountId, input.accountId), eq(workbenches.id, input.workbenchId)));
  if (!workbench) return null;
  const ownerId = userId === input.accountId ? "" : userId;
  // Keys outlive a workbench removal, so a project that syncs again keeps reading its relay data.
  await transaction
    .insert(spaceKeys)
    .values(
      spaces.map((space) => ({
        ...input,
        space,
        ownerId: space === "project" ? "" : ownerId,
        generation: 1,
        secret: createSecret(),
      })),
    )
    .onConflictDoNothing();
  const rows = await transaction
    .select({ space: spaceKeys.space, generation: spaceKeys.generation, secret: spaceKeys.secret })
    .from(spaceKeys)
    .where(
      and(
        eq(spaceKeys.accountId, input.accountId),
        eq(spaceKeys.workbenchId, input.workbenchId),
        or(eq(spaceKeys.space, "project"), eq(spaceKeys.ownerId, ownerId)),
      ),
    )
    .orderBy(asc(spaceKeys.generation));
  const of = (space: (typeof spaces)[number]) =>
    rows.filter((row) => row.space === space).map(({ generation, secret }) => ({ generation, secret }));
  return { project: of("project"), personal: of("personal") };
};
