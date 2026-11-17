import { sql } from "drizzle-orm";
import { projectKey } from "./accounts";
import type { connectRelay } from "./database";

type RelayDb = ReturnType<typeof connectRelay>["db"];

const count = (value: unknown) => Number(value ?? 0);
const at = (value: unknown) => (value ? new Date(value as string).toISOString() : null);

/**
 * What one account stores on the relay, for an operator. Metadata only: sizes, counts and times of the
 * sealed rows, never their contents.
 *
 * It reports what cleanup acts on, without walking blob trees: a recursive walk keeps its whole
 * working set in memory, which a large account can exhaust on a small database.
 * - Orphaned blobs: no update or state lists them and no parent that is not being deleted holds them.
 *   These are exactly the blobs `blobRetirementPage` can retire, at their own time plus the grace
 *   period. Their children become orphans after they go, in a later hourly pass.
 * - Settled rows: covered updates and replaced states, removed at their settle time plus the grace period.
 *   The blobs they list stay one more grace period after that (`removeRows`).
 *
 * Every query runs in one read-only snapshot with statement and lock timeouts, so the report is
 * consistent and cannot hold up the relay's own writes or migrations.
 */
export const inspectRelayAccount = async (
  db: RelayDb,
  input: {
    accountId: string;
    projectIds?: string[];
    gracePeriodMs: number;
    now?: Date;
    largestDocuments?: number;
    statementTimeoutMs?: number;
  },
) => {
  const { accountId, gracePeriodMs } = input;
  const now = input.now ?? new Date();
  const labels = new Map((input.projectIds ?? []).map((id) => [projectKey(accountId, id), id]));
  const grace = sql`${gracePeriodMs} * interval '1 millisecond'`;
  const owned = sql`SELECT "projectKey" FROM relay_sync_projects WHERE "accountId" = ${accountId}`;
  const listed = sql`
    SELECT "projectKey", unnest("blobIds") AS "blobId" FROM relay_sync_updates WHERE "projectKey" IN (${owned})
    UNION
    SELECT "projectKey", unnest("blobIds") FROM relay_sync_states WHERE "projectKey" IN (${owned})`;
  const held = sql`
    SELECT DISTINCT "projectKey", unnest(children) AS "blobId" FROM relay_sync_blobs
    WHERE "projectKey" IN (${owned}) AND status <> 'deleting'`;

  return db.transaction(
    async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL statement_timeout = ${Math.round(input.statementTimeoutMs ?? 300_000)}`));
      await tx.execute(sql`SET LOCAL lock_timeout = 3000`);
      const projects = await tx.execute<{ projectKey: string; createdAt: string }>(sql`
        SELECT "projectKey", "createdAt" FROM relay_sync_projects WHERE "accountId" = ${accountId}
        ORDER BY "createdAt"`);
      const documents = await tx.execute<{ projectKey: string; project: string; personal: string }>(sql`
        SELECT "projectKey", count(*) FILTER (WHERE "spaceOwner" IS NULL) AS project,
          count(*) FILTER (WHERE "spaceOwner" IS NOT NULL) AS personal
        FROM relay_sync_documents WHERE "projectKey" IN (${owned}) GROUP BY "projectKey"`);
      const rows = await tx.execute<{
        projectKey: string;
        kind: string;
        count: string;
        bytes: string;
        settled: string;
        settledBytes: string;
        removableFrom: string | null;
        removableUntil: string | null;
      }>(sql`
        SELECT "projectKey", 'updates' AS kind, count(*) AS count, sum("byteLength") AS bytes,
          count(*) FILTER (WHERE "coveredAt" IS NOT NULL) AS settled,
          coalesce(sum("byteLength") FILTER (WHERE "coveredAt" IS NOT NULL), 0) AS "settledBytes",
          min("coveredAt") + ${grace} AS "removableFrom", max("coveredAt") + ${grace} AS "removableUntil"
        FROM relay_sync_updates WHERE "projectKey" IN (${owned}) GROUP BY "projectKey"
        UNION ALL
        SELECT "projectKey", 'states', count(*), sum("byteLength"), count(*) FILTER (WHERE "replacedAt" IS NOT NULL),
          coalesce(sum("byteLength") FILTER (WHERE "replacedAt" IS NOT NULL), 0),
          min("replacedAt") + ${grace}, max("replacedAt") + ${grace}
        FROM relay_sync_states WHERE "projectKey" IN (${owned}) GROUP BY "projectKey"`);
      const blobs = await tx.execute<{ projectKey: string; status: string; count: string; bytes: string }>(sql`
        SELECT "projectKey", status, count(*) AS count, sum("byteLength") AS bytes
        FROM relay_sync_blobs WHERE "projectKey" IN (${owned}) GROUP BY "projectKey", status`);
      const orphans = await tx.execute<{
        projectKey: string;
        count: string;
        bytes: string;
        retirableNow: string;
        retirableFrom: string | null;
        retirableUntil: string | null;
      }>(sql`
        WITH listed AS MATERIALIZED (${listed}), held AS MATERIALIZED (${held}),
        orphans AS (
          SELECT b."projectKey", b."byteLength",
            CASE WHEN b.status = 'open' THEN b."createdAt" ELSE coalesce(b."lastUsedAt", b."completedAt") END + ${grace}
              AS "retirableAt"
          FROM relay_sync_blobs b
          WHERE b."projectKey" IN (${owned}) AND b.status <> 'deleting'
            AND NOT EXISTS (SELECT 1 FROM listed l WHERE l."projectKey" = b."projectKey" AND l."blobId" = b."blobId")
            AND NOT EXISTS (SELECT 1 FROM held h WHERE h."projectKey" = b."projectKey" AND h."blobId" = b."blobId")
        )
        SELECT "projectKey", count(*) AS count, sum("byteLength") AS bytes,
          count(*) FILTER (WHERE "retirableAt" <= ${now}) AS "retirableNow",
          min("retirableAt") AS "retirableFrom", max("retirableAt") AS "retirableUntil"
        FROM orphans GROUP BY "projectKey"`);
      // A document's own updates and states plus the blobs they list directly; their subtrees are not
      // walked, so a folder copy shows its manifest roots here and its chunks in the project's blob totals.
      const largest = await tx.execute<{
        projectKey: string;
        documentId: string;
        spaceOwner: string | null;
        bytes: string;
      }>(sql`
        WITH direct AS (
          SELECT DISTINCT r."projectKey", r."documentId", r."blobId" FROM (
            SELECT "projectKey", "documentId", unnest("blobIds") AS "blobId" FROM relay_sync_updates
            WHERE "projectKey" IN (${owned})
            UNION ALL
            SELECT "projectKey", "documentId", unnest("blobIds") FROM relay_sync_states WHERE "projectKey" IN (${owned})
          ) r
        ), blob_bytes AS (
          SELECT d."projectKey", d."documentId", sum(b."byteLength") AS bytes FROM direct d
          JOIN relay_sync_blobs b ON b."projectKey" = d."projectKey" AND b."blobId" = d."blobId"
          GROUP BY d."projectKey", d."documentId"
        ), payloads AS (
          SELECT "projectKey", "documentId", sum("byteLength") AS bytes FROM (
            SELECT "projectKey", "documentId", "byteLength" FROM relay_sync_updates WHERE "projectKey" IN (${owned})
            UNION ALL
            SELECT "projectKey", "documentId", "byteLength" FROM relay_sync_states WHERE "projectKey" IN (${owned})
          ) rows_of_documents GROUP BY "projectKey", "documentId"
        ), ranked AS (
          SELECT d."projectKey", d."documentId", d."spaceOwner",
            coalesce(payloads.bytes, 0) + coalesce(blob_bytes.bytes, 0) AS bytes,
            row_number() OVER (PARTITION BY d."projectKey"
              ORDER BY coalesce(payloads.bytes, 0) + coalesce(blob_bytes.bytes, 0) DESC, d."documentId") AS rank
          FROM relay_sync_documents d
          LEFT JOIN payloads ON payloads."projectKey" = d."projectKey" AND payloads."documentId" = d."documentId"
          LEFT JOIN blob_bytes ON blob_bytes."projectKey" = d."projectKey" AND blob_bytes."documentId" = d."documentId"
          WHERE d."projectKey" IN (${owned})
        )
        SELECT "projectKey", "documentId", "spaceOwner", bytes FROM ranked
        WHERE rank <= ${input.largestDocuments ?? 5} ORDER BY "projectKey", rank`);

      const byProject = <T extends { projectKey: string }>(result: { rows: T[] }, key: string) =>
        result.rows.filter((row) => row.projectKey === key);
      const report = projects.rows.map(({ projectKey: key, createdAt }) => {
        const docs = byProject(documents, key)[0];
        const payload = (kind: string) => byProject(rows, key).find((row) => row.kind === kind);
        const status = (name: string) => {
          const row = byProject(blobs, key).find((entry) => entry.status === name);
          return { count: count(row?.count), bytes: count(row?.bytes) };
        };
        const settled = (row: ReturnType<typeof payload>) => ({
          count: count(row?.settled),
          bytes: count(row?.settledBytes),
          removableFrom: at(row?.removableFrom),
          removableUntil: at(row?.removableUntil),
        });
        const updates = payload("updates");
        const states = payload("states");
        const orphan = byProject(orphans, key)[0];
        const blobStatus = { open: status("open"), completed: status("completed"), deleting: status("deleting") };
        return {
          projectKey: key,
          projectId: labels.get(key) ?? null,
          createdAt: at(createdAt),
          documents: { project: count(docs?.project), personal: count(docs?.personal) },
          updates: { count: count(updates?.count), bytes: count(updates?.bytes), covered: settled(updates) },
          states: { count: count(states?.count), bytes: count(states?.bytes), replaced: settled(states) },
          blobs: blobStatus,
          orphanedBlobs: {
            count: count(orphan?.count),
            bytes: count(orphan?.bytes),
            retirableNow: count(orphan?.retirableNow),
            retirableFrom: at(orphan?.retirableFrom),
            retirableUntil: at(orphan?.retirableUntil),
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
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
};
