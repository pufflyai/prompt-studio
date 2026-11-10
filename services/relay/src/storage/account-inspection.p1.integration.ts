import { afterAll, beforeAll, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { runRelayInspection } from "../../scripts/account-inspection";
import { inspectRelayAccount } from "./account-inspection";
import { projectKey } from "./accounts";
import { blobRetirementPage } from "./blob-retirement";
import { connectRelay } from "./database";
import { createSyncFixture } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const day = 86_400_000;

test("an operator sees each project's sizes and exactly what cleanup can retire, and when", async () => {
  const connection = connectRelay(fixture.databaseUrl);
  const account = `inspect-${crypto.randomUUID()}`;
  const other = `inspect-other-${crypto.randomUUID()}`;
  const known = projectKey(account, "alpha");
  const unlabelled = projectKey(account, "beta");
  const foreign = projectKey(other, "alpha");
  const run = (query: ReturnType<typeof sql>) => connection.db.execute(query);
  const blob = (
    key: string,
    id: string,
    bytes: number,
    status: string,
    times: string,
    options: { children?: string[]; lastUsed?: string } = {},
  ) =>
    run(sql`INSERT INTO relay_sync_blobs ("projectKey", "blobId", sha256, "byteLength", status, "createdAt",
      "completedAt", "lastUsedAt", children)
      VALUES (${key}, ${id}, ${"a".repeat(64)}, ${bytes}, ${status}, ${times}::timestamptz,
        ${status === "open" ? null : times}::timestamptz, ${options.lastUsed ?? null}::timestamptz,
        ${sql.param(options.children ?? [])}::text[])`);
  const update = (key: string, document: string, sequence: number, blobIds: string[], covered: string | null) =>
    run(sql`INSERT INTO relay_sync_updates ("projectKey", "documentId", sequence, "updateId", "deviceId",
      "byteLength", "objectKey", "blobIds", "createdAt", "coveredAt")
      VALUES (${key}, ${document}, ${sequence}, ${`update-${sequence}`}, 'laptop', 10, ${crypto.randomUUID()},
        ${sql.param(blobIds)}::text[], '2026-11-02', ${covered}::timestamptz)`);
  try {
    for (const [key, owner] of [
      [known, account],
      [unlabelled, account],
      [foreign, other],
    ] as const)
      await run(sql`INSERT INTO relay_sync_projects ("projectKey", "accountId", "createdAt")
        VALUES (${key}, ${owner}, '2026-11-01')`);
    await run(sql`INSERT INTO relay_sync_documents ("projectKey", "documentId", "spaceOwner", "lastSequence")
      VALUES (${known}, 'records', NULL, 2), (${known}, 'folder-copy', ${account}, 0),
        (${unlabelled}, 'empty', NULL, 0), (${foreign}, 'records', NULL, 1)`);
    // `records` keeps a chain through a live update and a blob through a covered one; `folder-copy`
    // keeps its root through a replaced state.
    await blob(known, "root", 100, "completed", "2026-11-02", { children: ["child"] });
    await blob(known, "child", 50, "completed", "2026-11-02");
    await blob(known, "settled", 30, "completed", "2026-11-02");
    await blob(known, "copy", 1000, "completed", "2026-11-03");
    await update(known, "records", 1, ["root"], null);
    await update(known, "records", 2, ["settled"], "2026-11-06");
    await run(sql`INSERT INTO relay_sync_states ("projectKey", "documentId", "stateId", "baseStateId", through,
      "byteLength", summary, "objectKey", "blobIds", "deviceId", "createdAt", "replacedAt")
      VALUES (${known}, 'folder-copy', 'state-1', NULL, 0, 20, 'summary', ${crypto.randomUUID()}, ARRAY['copy'],
        'laptop', '2026-11-03', '2026-11-04')`);
    // Left by uploads that never finished or were never published.
    await blob(known, "unfinished", 7, "open", "2026-11-01");
    await blob(known, "orphan", 9, "completed", "2026-10-01", { lastUsed: "2026-11-08" });
    // An unreferenced manifest still holds its chunk: only the manifest is an orphan until it retires.
    await blob(known, "manifest", 5, "completed", "2026-11-09", { children: ["chunk"] });
    await blob(known, "chunk", 500, "completed", "2026-10-01");
    // A parent being deleted no longer holds its child.
    await blob(known, "going", 3, "deleting", "2026-11-01", { children: ["freed"] });
    await blob(known, "freed", 2, "completed", "2026-10-20");
    await blob(unlabelled, "lone", 4, "completed", "2026-11-09");
    await blob(foreign, "elsewhere", 999, "completed", "2026-10-01");

    const now = new Date("2026-11-10T00:00:00Z");
    const report = await inspectRelayAccount(connection.db, {
      accountId: account,
      projectIds: ["alpha", "missing"],
      gracePeriodMs: 7 * day,
      now,
    });

    expect(report).toMatchObject({ accountId: account, gracePeriodDays: 7, absentProjectIds: ["missing"] });
    expect(report.projects.map((project) => project.projectKey).sort()).toEqual([known, unlabelled].sort());
    const alpha = report.projects.find((project) => project.projectKey === known)!;
    expect(alpha).toMatchObject({
      projectId: "alpha",
      documents: { project: 1, personal: 1 },
      updates: {
        count: 2,
        bytes: 20,
        covered: { count: 1, bytes: 10, removableFrom: "2026-11-13T00:00:00.000Z" },
      },
      states: { count: 1, bytes: 20, replaced: { count: 1, bytes: 20, removableFrom: "2026-11-11T00:00:00.000Z" } },
      blobs: {
        open: { count: 1, bytes: 7 },
        completed: { count: 8, bytes: 1696 },
        deleting: { count: 1, bytes: 3 },
      },
      orphanedBlobs: {
        count: 4,
        bytes: 7 + 9 + 5 + 2,
        retirableNow: 2,
        retirableFrom: "2026-10-27T00:00:00.000Z",
        retirableUntil: "2026-11-16T00:00:00.000Z",
      },
      bytes: 20 + 20 + 7 + 1696 + 3,
    });
    expect(alpha.largestDocuments).toEqual([
      { documentId: "folder-copy", space: "personal", bytes: 1020 },
      { documentId: "records", space: "project", bytes: 150 },
    ]);
    const beta = report.projects.find((project) => project.projectKey === unlabelled)!;
    expect(beta).toMatchObject({ projectId: null, orphanedBlobs: { count: 1, bytes: 4, retirableNow: 0 }, bytes: 4 });
    expect(report.bytes).toBe(alpha.bytes + beta.bytes);

    // The report agrees with the relay's own retirement rule at the same moment.
    let retirable = 0;
    for (const key of [known, unlabelled]) {
      const page = await connection.db.execute<{ retire: boolean }>(
        blobRetirementPage(account, new Date(now.getTime() - 7 * day), { projectKey: key, blobId: "" }),
      );
      retirable += page.rows.filter((row) => row.retire).length;
    }
    expect(retirable).toBe(alpha.orphanedBlobs.retirableNow + beta.orphanedBlobs.retirableNow);

    // The operator entry point uses the grace period it is given and labels the named projects.
    const operator = await runRelayInspection(["--account", account, "--project", "alpha"], fixture.databaseUrl, {
      RELAY_GRACE_PERIOD_SECONDS: String(2 * 86_400),
    });
    expect(operator.gracePeriodDays).toBe(2);
    expect(operator.projects.find((project) => project.projectId === "alpha")?.bytes).toBe(alpha.bytes);
    await expect(runRelayInspection([], fixture.databaseUrl)).rejects.toThrow();
  } finally {
    await connection.close();
  }
});
