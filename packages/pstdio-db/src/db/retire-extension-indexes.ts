import { and, eq, ne, sql } from "drizzle-orm";
import { resourceActivityOwnerId } from "pstdio-api-contracts";
import type { Json, StorageRecordIndex } from "pstdio-sync-contracts";
import { dropRecordIndexObjects, queryDefinitionName } from "../services/extension-storage/record-index-lifecycle";
import { recordIndexRows, saveRecordIndexRow } from "../services/extension-storage/record-index-rows";
import { decodeProjectionValue } from "../services/extension-storage/record-projection-codec";
import type { DbClient } from "./connection.pglite";
import { owners } from "./schemas/owners";

/** Inactive extensions may never register again. Replace one old catalog entry and
 * its SQL objects in one transaction so a pause or restart always leaves it queryable. */
export const createExtensionIndexCleanup = (db: DbClient) => {
  let done = false;
  return async (stopped: () => boolean) => {
    while (!done && !stopped()) {
      await Bun.sleep(0);
      if (stopped()) return;
      done = await db.transaction(async (tx) => {
        const [row] = await tx
          .select({
            entry: {
              owner_id: recordIndexRows.owner_id,
              name: recordIndexRows.name,
              definition: recordIndexRows.definition,
              database_name: recordIndexRows.database_name,
            },
            workbenchId: owners.project_id,
            extensionId: owners.extension_id,
          })
          .from(recordIndexRows)
          .innerJoin(owners, eq(owners.id, recordIndexRows.owner_id))
          .where(
            and(
              ne(owners.extension_id, resourceActivityOwnerId),
              sql`starts_with(${recordIndexRows.database_name}, 'storage_query_')`,
            ),
          )
          .limit(1);
        if (!row) return true;
        const definition = decodeProjectionValue(
          row.entry.definition as unknown as Json,
        ) as unknown as StorageRecordIndex;
        await dropRecordIndexObjects(tx, [{ ...row.entry, definition }]);
        await saveRecordIndexRow(tx, {
          ...row.entry,
          database_name: await queryDefinitionName(row, row.entry.owner_id, definition),
        });
        return false;
      });
    }
  };
};
