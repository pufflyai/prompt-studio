import { and, asc, eq, exists, inArray, max, notExists, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { SpaceKeys } from "pstdio-sync-contracts";
import { readAccountFeatures } from "./account-features";
import type { WorkbenchInput } from "./contracts";
import type { ManagerTransaction } from "./database";
import { projectDeletions, projectMembers, spaceKeys, workbenches } from "./schema";

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

// A removed device keeps old keys. Rotate before issuing the next generation to retained devices.
export const rotatePersonalAccountKeys = (transaction: ManagerTransaction, accountId: string) =>
  rotateMatchingKeys(transaction, accountId);

export const rotateTeamKeysForRemovedDevice = (transaction: ManagerTransaction, accountId: string, userId: string) => {
  const issued = alias(spaceKeys, "issued_private_keys");
  const grant = exists(
    transaction
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.accountId, spaceKeys.accountId),
          eq(projectMembers.workbenchId, spaceKeys.workbenchId),
          eq(projectMembers.userId, userId),
        ),
      ),
  );
  // Making a project local drops the active grant rows. Issued keys for a paused project
  // must still rotate while nothing prevents the same workbench from syncing again later.
  const paused = and(
    notExists(
      transaction
        .select({ id: workbenches.id })
        .from(workbenches)
        .where(and(eq(workbenches.accountId, spaceKeys.accountId), eq(workbenches.id, spaceKeys.workbenchId))),
    ),
    exists(
      transaction
        .select({ ownerId: issued.ownerId })
        .from(issued)
        .where(
          and(
            eq(issued.accountId, spaceKeys.accountId),
            eq(issued.workbenchId, spaceKeys.workbenchId),
            eq(issued.ownerId, userId),
          ),
        ),
    ),
  );
  return rotateMatchingKeys(
    transaction,
    accountId,
    or(eq(spaceKeys.ownerId, userId), and(eq(spaceKeys.space, "project"), or(grant, paused))),
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
