import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { ResourceIdentity } from "pstdio-api-contracts/extension-kernel";
import { resourceNumbersDocumentId, coreOwnerId } from "pstdio-sync";
import type { DbClient } from "../db/connection.pglite";
import {
  storage_resource_aliases as aliases,
  storage_resource_identities as identities,
  storage_resource_projections as projections,
  storage_documents,
} from "../db/schemas.pg";
import type { createDocumentStorageDBService } from "./extension-storage/document-storage";

export const upgradeResourceIdentityIndexes = async (
  db: DbClient,
  documents: ReturnType<typeof createDocumentStorageDBService>,
) => {
  const outdated = await db
    .select({ projectId: storage_documents.workbench_id })
    .from(storage_documents)
    .leftJoin(projections, eq(projections.workbench_id, storage_documents.workbench_id))
    .where(
      and(
        eq(storage_documents.extension_id, coreOwnerId),
        eq(storage_documents.document_id, resourceNumbersDocumentId),
        or(isNull(projections.workbench_id), ne(projections.revision, storage_documents.revision)),
      ),
    );
  for (const { projectId } of outdated)
    await documents.documents
      .open(resourceNumbersDocumentId)
      .transaction({ workbenchId: projectId, extensionId: coreOwnerId }, async (state) => {
        if (!state.rebuildProjection) throw new Error("Resource identity projection upgrade is unavailable");
        await state.rebuildProjection();
      });
};

export const createResourceIdentityIndex = (db: DbClient, ready: Promise<void>) => {
  type Address = { projectId: string; extensionId: string; kind: string };
  type Connection = Pick<DbClient, "select">;
  const ownerWhere = (input: Address) =>
    and(
      eq(identities.workbench_id, input.projectId),
      eq(identities.extension_id, input.extensionId),
      eq(identities.kind, input.kind),
    );
  const assertCurrent = async (connection: Connection, projectId: string) => {
    const [row] = await connection
      .select({ current: storage_documents.revision, projected: projections.revision })
      .from(storage_documents)
      .leftJoin(projections, eq(projections.workbench_id, storage_documents.workbench_id))
      .where(
        and(
          eq(storage_documents.workbench_id, projectId),
          eq(storage_documents.extension_id, coreOwnerId),
          eq(storage_documents.document_id, resourceNumbersDocumentId),
        ),
      );
    if (row && row.current !== row.projected)
      throw new Error("Resource identity projection is stale; upgrade before reading");
  };
  const readRows = async (connection: Connection, input: Address, rows: (typeof identities.$inferSelect)[]) => {
    if (!rows.length) return [];
    const found = await connection
      .select()
      .from(aliases)
      .where(
        and(
          eq(aliases.workbench_id, input.projectId),
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
    await ready;
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
      await ready;
      return db.transaction(async (tx) => {
        await assertCurrent(tx, input.projectId);
        const aliasesForNumber = tx
          .select({ id: aliases.resource_id })
          .from(aliases)
          .where(and(eq(aliases.workbench_id, input.projectId), eq(aliases.shorthand, input.shorthand)));
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
