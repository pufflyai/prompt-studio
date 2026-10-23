import { sql } from "drizzle-orm";

/**
 * Read one primary-key page before testing eligibility, so retained/recent rows
 * cannot make a page rescan an owner prefix. At most one page crosses the project
 * boundary; those rows are filtered before returning any candidate.
 *
 * Parents must retire first. A parentless node needs only direct retained-root
 * witnesses, not a walk of every retained descendant. Materialized reference
 * lookups separate the inverted-index lookup from exact project authorization.
 */
export const blobRetirementPage = (
  accountId: string,
  cutoff: Date,
  after: { projectKey: string; blobId: string },
) => sql`
  WITH bounded AS MATERIALIZED (
    SELECT b.* FROM relay_sync_blobs b
    WHERE (b."projectKey", b."blobId") > (${after.projectKey}, ${after.blobId})
    ORDER BY b."projectKey", b."blobId" LIMIT 500
  ), page AS MATERIALIZED (
    SELECT b.* FROM bounded b WHERE b."projectKey" = ${after.projectKey}
      AND EXISTS (SELECT 1 FROM relay_sync_projects project
        WHERE project."projectKey" = b."projectKey" AND project."accountId" = ${accountId})
  )
  SELECT p."projectKey", p."blobId",
    ((p.status = 'open' AND p."createdAt" <= ${cutoff})
      OR (p.status = 'completed' AND coalesce(p."lastUsedAt", p."completedAt") <= ${cutoff})) AND
    (WITH refs AS MATERIALIZED (
      SELECT "projectKey" FROM relay_sync_updates WHERE "blobIds" @> ARRAY[p."blobId"]
    ) SELECT 1 FROM refs WHERE "projectKey" = p."projectKey" LIMIT 1) IS NULL
    AND (WITH refs AS MATERIALIZED (
      SELECT "projectKey" FROM relay_sync_states WHERE "blobIds" @> ARRAY[p."blobId"]
    ) SELECT 1 FROM refs WHERE "projectKey" = p."projectKey" LIMIT 1) IS NULL
    AND (WITH parents AS MATERIALIZED (
      SELECT "projectKey", status FROM relay_sync_blobs WHERE children @> ARRAY[p."blobId"]
    ) SELECT 1 FROM parents WHERE "projectKey" = p."projectKey" AND status <> 'deleting' LIMIT 1) IS NULL AS retire
  FROM page p ORDER BY p."projectKey", p."blobId"`;
