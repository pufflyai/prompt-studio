import { sql } from "drizzle-orm";

/**
 * Read one primary-key page before testing eligibility, so retained/recent rows
 * cannot make a page rescan an owner prefix. At most one page crosses the project
 * boundary; those rows are filtered before returning any candidate.
 *
 * Parents must retire first. A parentless node needs only direct retained-root
 * witnesses, not a walk of every retained descendant. Materialized reference
 * lookups run once per page, including when a small reference table chooses a
 * sequential scan. Exact project authorization still follows the index lookup.
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
  ), update_refs AS MATERIALIZED (
    SELECT "projectKey", "blobIds" FROM relay_sync_updates
    WHERE "blobIds" && ARRAY(SELECT "blobId" FROM page)
  ), state_refs AS MATERIALIZED (
    SELECT "projectKey", "blobIds" FROM relay_sync_states
    WHERE "blobIds" && ARRAY(SELECT "blobId" FROM page)
  ), parents AS MATERIALIZED (
    SELECT "projectKey", status, children FROM relay_sync_blobs
    WHERE children && ARRAY(SELECT "blobId" FROM page)
  )
  SELECT p."projectKey", p."blobId",
    ((p.status = 'open' AND p."createdAt" <= ${cutoff})
      OR (p.status = 'completed' AND coalesce(p."lastUsedAt", p."completedAt") <= ${cutoff})) AND
    NOT EXISTS (SELECT 1 FROM update_refs r
      WHERE r."projectKey" = p."projectKey" AND r."blobIds" @> ARRAY[p."blobId"])
    AND NOT EXISTS (SELECT 1 FROM state_refs r
      WHERE r."projectKey" = p."projectKey" AND r."blobIds" @> ARRAY[p."blobId"])
    AND NOT EXISTS (SELECT 1 FROM parents r
      WHERE r."projectKey" = p."projectKey" AND r.status <> 'deleting'
        AND r.children @> ARRAY[p."blobId"]) AS retire
  FROM page p ORDER BY p."projectKey", p."blobId"`;
