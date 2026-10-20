import { and, asc, eq, max } from "drizzle-orm";
import type { SpaceKeys } from "pstdio-sync-contracts";
import type { WorkbenchInput } from "./contracts";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { spaceKeys } from "./schema";

type Reader = Pick<ManagerDatabase, "select">;
const spaces = ["project", "personal"] as const;
const createSecret = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

// Adding a workbench again keeps its keys, so earlier relay data stays readable.
export const createSpaceKeysInTransaction = (transaction: ManagerTransaction, input: WorkbenchInput) =>
  transaction
    .insert(spaceKeys)
    .values(spaces.map((space) => ({ ...input, space, generation: 1, secret: createSecret() })))
    .onConflictDoNothing();

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

export const listSpaceKeys = async (db: Reader, input: WorkbenchInput): Promise<SpaceKeys> => {
  const rows = await db
    .select({ space: spaceKeys.space, generation: spaceKeys.generation, secret: spaceKeys.secret })
    .from(spaceKeys)
    .where(and(eq(spaceKeys.accountId, input.accountId), eq(spaceKeys.workbenchId, input.workbenchId)))
    .orderBy(asc(spaceKeys.generation));
  const of = (space: (typeof spaces)[number]) =>
    rows.filter((row) => row.space === space).map(({ generation, secret }) => ({ generation, secret }));
  return { project: of("project"), personal: of("personal") };
};
