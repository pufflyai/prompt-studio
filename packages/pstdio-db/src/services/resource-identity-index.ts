import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { ResourceIdentity } from "pstdio-api-contracts/extension-kernel";
import { coreOwnerId } from "pstdio-sync/records";
import type { DbClient } from "../db/connection.pglite";
import { resource_numbers as aliases, resource_numbers as identities, owners as recordOwners } from "../db/schemas.pg";
import { assertStorageOwnerAdmitted } from "../db/storage-admission";
import { storageOwnerKey } from "./extension-storage/storage-owner-key";

export const createResourceIdentityIndex = (db: DbClient) => {
  type Address = { projectId: string; extensionId: string; kind: string };
  type Connection = Pick<DbClient, "select">;
  const ownerWhere = (input: Address) =>
    and(
      eq(identities.project_id, input.projectId),
      eq(identities.current, true),
      eq(identities.extension_id, input.extensionId),
      eq(identities.kind, input.kind),
    );
  const assertCurrent = async (connection: Connection, projectId: string) => {
    assertStorageOwnerAdmitted(db, { workbenchId: projectId, extensionId: coreOwnerId });
    const [row] = await connection
      .select({ current: recordOwners.revision, projected: recordOwners.numbers_revision })
      .from(recordOwners)
      .where(and(eq(recordOwners.id, storageOwnerKey({ workbenchId: projectId, extensionId: coreOwnerId }))));
    if (row && row.current !== (row.projected ?? 0))
      throw new Error("Resource identity projection is stale; upgrade before reading");
  };
  const readRows = async (connection: Connection, input: Address, rows: (typeof identities.$inferSelect)[]) => {
    if (!rows.length) return [];
    const found = await connection
      .select()
      .from(aliases)
      .where(
        and(
          eq(aliases.project_id, input.projectId),
          eq(aliases.alias, true),
          inArray(
            aliases.resource_id,
            rows.map((row) => row.resource_id),
          ),
        ),
      )
      .orderBy(aliases.shorthand);
    const byId = new Map<string, string[]>();
    for (const alias of found) {
      const values = byId.get(alias.resource_id) ?? [];
      values.push(alias.shorthand);
      byId.set(alias.resource_id, values);
    }
    return rows.map((row) => ({
      id: row.resource_id,
      kind: row.kind,
      shorthand: row.shorthand,
      aliases: (byId.get(row.resource_id) ?? []).filter((alias) => alias !== row.shorthand),
    })) satisfies ResourceIdentity[];
  };
  const identityMany = async (input: Address & { ids: string[] }) => {
    if (input.ids.length > 100) throw new Error("An identity batch can read at most 100 resources");
    if (!input.ids.length) return [];
    return db.transaction(async (tx) => {
      await assertCurrent(tx, input.projectId);
      const rows = await tx
        .select()
        .from(identities)
        .where(and(ownerWhere(input), inArray(identities.resource_id, input.ids)));
      const values = new Map((await readRows(tx, input, rows)).map((resource) => [resource.id, resource]));
      return input.ids.map((id) => values.get(id) ?? null);
    });
  };
  return {
    identityMany,
    identity: async (input: Address & { id: string }) => (await identityMany({ ...input, ids: [input.id] }))[0] ?? null,
    findByShorthand: async (input: Address & { shorthand: string }) => {
      return db.transaction(async (tx) => {
        await assertCurrent(tx, input.projectId);
        const aliasesForNumber = tx
          .select({ id: aliases.resource_id })
          .from(aliases)
          .where(
            and(
              eq(aliases.project_id, input.projectId),
              eq(aliases.alias, true),
              eq(aliases.shorthand, input.shorthand),
            ),
          );
        const rows = await tx
          .select()
          .from(identities)
          .where(
            and(
              ownerWhere(input),
              or(eq(identities.shorthand, input.shorthand), inArray(identities.resource_id, aliasesForNumber)),
            ),
          )
          .orderBy(sql`${identities.shorthand} = ${input.shorthand} DESC`, identities.resource_id);
        return readRows(tx, input, rows);
      });
    },
  };
};
