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
  owner: StorageOwner & { ownerId?: number },
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
  // rid is a primary key: membership is one boolean, not a document/identity join.
  // Keeping that cardinality avoids flattening broad matches into all-pairs comparisons.
  const id = identityQueryText(recordFieldSql(index, identity.idField));
  return sql`${recordScopeSql(owner, { ...index, identity: undefined })}
    AND (SELECT identity_membership.mapped AND identity_membership.named
      FROM ${sql.identifier(`${physicalName}_i`)} AS identity_membership
      WHERE identity_membership.rid = ${id}) IS TRUE`;
};
