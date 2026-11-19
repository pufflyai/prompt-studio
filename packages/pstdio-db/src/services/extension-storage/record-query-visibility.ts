import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { identityQueryText } from "./record-identity-query";
import { recordIndexName } from "./record-index-lifecycle";
import { recordFieldSql, recordScopeSql } from "./record-query-sql";

/** Count indexes already maintain both identity halves in the same transaction.
 * Reuse their eligibility for ordinary pages and canonical filtered aggregates too.
 */
export const recordVisibilitySql = async (
  owner: StorageOwner,
  index: StorageRecordIndex,
  declared: StorageRecordIndex,
  physicalName: string | undefined,
) => {
  const identity = index.identity;
  if (
    !identity ||
    !declared.countBy?.length ||
    !physicalName?.startsWith("storage_query_v4_") ||
    physicalName !== (await recordIndexName(owner, declared))
  )
    return recordScopeSql(owner, index);

  // Query validation prevents replacing the declared local identity field.
  const id = identityQueryText(recordFieldSql(index, identity.idField));
  return sql`${recordScopeSql(owner, { ...index, identity: undefined })}
    AND EXISTS (SELECT 1 FROM ${sql.identifier(`${physicalName}_i`)} AS identity_membership
      WHERE identity_membership.rid = ${id} AND identity_membership.mapped AND identity_membership.named)`;
};
