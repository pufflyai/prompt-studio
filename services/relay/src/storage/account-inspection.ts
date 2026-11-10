import { sql } from "drizzle-orm";
import { projectKey } from "./accounts";
import type { connectRelay } from "./database";

type RelayDb = ReturnType<typeof connectRelay>["db"];

const count = (value: unknown) => Number(value ?? 0);
const at = (value: unknown) => (value ? new Date(value as string).toISOString() : null);

/**
 * What one account stores on the relay, for an operator. Metadata only: sizes, counts and times of the
 * sealed rows, never their contents. A blob is referenced while an update or latest state lists it,
 * directly or through parent blobs; an unreferenced one becomes eligible for retirement once the grace
 * period has passed since its last use, as `blobRetirementPage` decides.
 */
export const inspectRelayAccount = async (
  db: RelayDb,
  input: { accountId: string; projectIds?: string[]; gracePeriodMs: number; now?: Date; largestDocuments?: number },
) => {
  const { accountId, gracePeriodMs } = input;
  const now = input.now ?? new Date();
  const labels = new Map((input.projectIds ?? []).map((id) => [projectKey(accountId, id), id]));
  const grace = sql`${gracePeriodMs} * interval '1 millisecond'`;
  const owned = sql`SELECT "projectKey" FROM relay_sync_projects WHERE "accountId" = ${accountId}`;

  const projects = await db.execute<{ projectKey: string; createdAt: string }>(sql`
    SELECT "projectKey", "createdAt" FROM relay_sync_projects WHERE "accountId" = ${accountId} ORDER BY "createdAt"`);
  const documents = await db.execute<{ projectKey: string; project: string; personal: string }>(sql`
    SELECT "projectKey", count(*) FILTER (WHERE "spaceOwner" IS NULL) AS project,
      count(*) FILTER (WHERE "spaceOwner" IS NOT NULL) AS personal
    FROM relay_sync_documents WHERE "projectKey" IN (${owned}) GROUP BY "projectKey"`);
  const rows = await db.execute<{
    projectKey: string;
    kind: string;
    count: string;
    bytes: string;
    settled: string;
  }>(sql`
    SELECT "projectKey", 'updates' AS kind, count(*) AS count, sum("byteLength") AS bytes,
      count(*) FILTER (WHERE "coveredAt" IS NOT NULL) AS settled
    FROM relay_sync_updates WHERE "projectKey" IN (${owned}) GROUP BY "projectKey"
    UNION ALL
    SELECT "projectKey", 'states', count(*), sum("byteLength"), count(*) FILTER (WHERE "replacedAt" IS NOT NULL)
    FROM relay_sync_states WHERE "projectKey" IN (${owned}) GROUP BY "projectKey"`);
  const blobs = await db.execute<{ projectKey: string; status: string; count: string; bytes: string }>(sql`
    SELECT "projectKey", status, count(*) AS count, sum("byteLength") AS bytes
    FROM relay_sync_blobs WHERE "projectKey" IN (${owned}) GROUP BY "projectKey", status`);
  // Every blob an update or state reaches, per document. Parents that are already being deleted no
  // longer keep their children, as in retirement.
  const reachable = sql`
    WITH RECURSIVE reach("projectKey", "documentId", "blobId") AS (
      SELECT "projectKey", "documentId", unnest("blobIds") FROM relay_sync_updates WHERE "projectKey" IN (${owned})
      UNION
      SELECT "projectKey", "documentId", unnest("blobIds") FROM relay_sync_states WHERE "projectKey" IN (${owned})
      UNION
      SELECT b."projectKey", r."documentId", unnest(b.children) FROM relay_sync_blobs b
        JOIN reach r ON r."projectKey" = b."projectKey" AND r."blobId" = b."blobId" WHERE b.status <> 'deleting'
    )`;
  const unreferenced = await db.execute<{
    projectKey: string;
    count: string;
    bytes: string;
    eligibleFrom: string | null;
    eligibleUntil: string | null;
  }>(sql`
    ${reachable}
    SELECT b."projectKey", count(*) AS count, sum(b."byteLength") AS bytes,
      min(CASE WHEN b.status = 'open' THEN b."createdAt" ELSE coalesce(b."lastUsedAt", b."completedAt") END + ${grace})
        AS "eligibleFrom",
      max(CASE WHEN b.status = 'open' THEN b."createdAt" ELSE coalesce(b."lastUsedAt", b."completedAt") END + ${grace})
        AS "eligibleUntil"
    FROM relay_sync_blobs b
    WHERE b."projectKey" IN (${owned}) AND b.status <> 'deleting'
      AND NOT EXISTS (SELECT 1 FROM reach r WHERE r."projectKey" = b."projectKey" AND r."blobId" = b."blobId")
    GROUP BY b."projectKey"`);
  const largest = await db.execute<{
    projectKey: string;
    documentId: string;
    spaceOwner: string | null;
    bytes: string;
  }>(
    sql`
    ${reachable}, referenced AS (
      SELECT r."projectKey", r."documentId", sum(b."byteLength") AS bytes
      FROM (SELECT DISTINCT * FROM reach) r
      JOIN relay_sync_blobs b ON b."projectKey" = r."projectKey" AND b."blobId" = r."blobId"
      GROUP BY r."projectKey", r."documentId"
    ), payloads AS (
      SELECT "projectKey", "documentId", sum("byteLength") AS bytes FROM (
        SELECT "projectKey", "documentId", "byteLength" FROM relay_sync_updates WHERE "projectKey" IN (${owned})
        UNION ALL
        SELECT "projectKey", "documentId", "byteLength" FROM relay_sync_states WHERE "projectKey" IN (${owned})
      ) rows_of_documents GROUP BY "projectKey", "documentId"
    ), ranked AS (
      SELECT d."projectKey", d."documentId", d."spaceOwner",
        coalesce(payloads.bytes, 0) + coalesce(referenced.bytes, 0) AS bytes,
        row_number() OVER (PARTITION BY d."projectKey"
          ORDER BY coalesce(payloads.bytes, 0) + coalesce(referenced.bytes, 0) DESC, d."documentId") AS rank
      FROM relay_sync_documents d
      LEFT JOIN payloads ON payloads."projectKey" = d."projectKey" AND payloads."documentId" = d."documentId"
      LEFT JOIN referenced ON referenced."projectKey" = d."projectKey" AND referenced."documentId" = d."documentId"
      WHERE d."projectKey" IN (${owned})
    )
    SELECT "projectKey", "documentId", "spaceOwner", bytes FROM ranked
    WHERE rank <= ${input.largestDocuments ?? 5} ORDER BY "projectKey", rank`,
  );

  const byProject = <T extends { projectKey: string }>(result: { rows: T[] }, key: string) =>
    result.rows.filter((row) => row.projectKey === key);
  const report = projects.rows.map(({ projectKey: key, createdAt }) => {
    const docs = byProject(documents, key)[0];
    const payload = (kind: string) => byProject(rows, key).find((row) => row.kind === kind);
    const status = (name: string) => {
      const row = byProject(blobs, key).find((entry) => entry.status === name);
      return { count: count(row?.count), bytes: count(row?.bytes) };
    };
    const updates = payload("updates");
    const states = payload("states");
    const loose = byProject(unreferenced, key)[0];
    const blobStatus = { open: status("open"), completed: status("completed"), deleting: status("deleting") };
    return {
      projectKey: key,
      projectId: labels.get(key) ?? null,
      createdAt: at(createdAt),
      documents: { project: count(docs?.project), personal: count(docs?.personal) },
      updates: { count: count(updates?.count), bytes: count(updates?.bytes), covered: count(updates?.settled) },
      states: { count: count(states?.count), bytes: count(states?.bytes), replaced: count(states?.settled) },
      blobs: blobStatus,
      unreferenced: {
        count: count(loose?.count),
        bytes: count(loose?.bytes),
        eligibleFrom: at(loose?.eligibleFrom),
        eligibleUntil: at(loose?.eligibleUntil),
      },
      largestDocuments: byProject(largest, key).map((row) => ({
        documentId: row.documentId,
        space: row.spaceOwner === null ? ("project" as const) : ("personal" as const),
        bytes: count(row.bytes),
      })),
      // The bytes this project counts against the account's quota (`requireQuota`).
      bytes:
        count(updates?.bytes) +
        count(states?.bytes) +
        blobStatus.open.bytes +
        blobStatus.completed.bytes +
        blobStatus.deleting.bytes,
    };
  });
  return {
    accountId,
    generatedAt: now.toISOString(),
    gracePeriodDays: gracePeriodMs / 86_400_000,
    bytes: report.reduce((sum, project) => sum + project.bytes, 0),
    projects: report,
    // Project IDs the operator named that hold nothing on the relay.
    absentProjectIds: [...labels].filter(([key]) => !report.some((p) => p.projectKey === key)).map(([, id]) => id),
  };
};
