import { afterAll, beforeAll, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { runRelayInspection } from "../../scripts/account-inspection";
import { inspectRelayAccount } from "./account-inspection";
import { projectKey } from "./accounts";
import { connectRelay } from "./database";
import { createSyncFixture } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const day = 86_400_000;

test("an operator sees each project's sizes, what is still referenced and when the rest can retire", async () => {
  const connection = connectRelay(fixture.databaseUrl);
  const account = `inspect-${crypto.randomUUID()}`;
  const other = `inspect-other-${crypto.randomUUID()}`;
  const known = projectKey(account, "alpha");
  const unlabelled = projectKey(account, "beta");
  const foreign = projectKey(other, "alpha");
  const run = (query: ReturnType<typeof sql>) => connection.db.execute(query);
  const blob = (key: string, id: string, bytes: number, status: string, times: string, children: string[] = []) =>
    run(sql`INSERT INTO relay_sync_blobs ("projectKey", "blobId", sha256, "byteLength", status, "createdAt",
      "completedAt", "lastUsedAt", children)
      VALUES (${key}, ${id}, ${"a".repeat(64)}, ${bytes}, ${status}, ${times}::timestamptz,
        ${status === "open" ? null : times}::timestamptz, NULL, ${sql.param(children)}::text[])`);
  try {
    for (const [key, owner] of [
      [known, account],
      [unlabelled, account],
      [foreign, other],
    ] as const)
      await run(sql`INSERT INTO relay_sync_projects ("projectKey", "accountId", "createdAt")
        VALUES (${key}, ${owner}, '2026-11-01')`);
    await run(sql`INSERT INTO relay_sync_documents ("projectKey", "documentId", "spaceOwner", "lastSequence")
      VALUES (${known}, 'records', NULL, 1), (${known}, 'folder-copy', ${account}, 0),
        (${unlabelled}, 'empty', NULL, 0), (${foreign}, 'records', NULL, 1)`);
    // `records` keeps a two-level chain through an update; `folder-copy` keeps one large blob through a
    // replaced state that still exists.
    await blob(known, "root", 100, "completed", "2026-11-02", ["child"]);
    await blob(known, "child", 50, "completed", "2026-11-02");
    await blob(known, "copy", 1000, "completed", "2026-11-03");
    await run(sql`INSERT INTO relay_sync_updates ("projectKey", "documentId", sequence, "updateId", "deviceId",
      "byteLength", "objectKey", "blobIds", "createdAt")
      VALUES (${known}, 'records', 1, 'update-1', 'laptop', 10, ${crypto.randomUUID()}, ARRAY['root'], '2026-11-02')`);
    await run(sql`INSERT INTO relay_sync_states ("projectKey", "documentId", "stateId", "baseStateId", through,
      "byteLength", summary, "objectKey", "blobIds", "deviceId", "createdAt", "replacedAt")
      VALUES (${known}, 'folder-copy', 'state-1', NULL, 0, 20, 'summary', ${crypto.randomUUID()}, ARRAY['copy'],
        'laptop', '2026-11-03', '2026-11-04')`);
    // Left by uploads that never finished or were never published, and one already being deleted.
    await blob(known, "unfinished", 7, "open", "2026-11-05");
    await blob(known, "orphan", 9, "completed", "2026-11-08");
    await blob(known, "going", 3, "deleting", "2026-11-01");
    await blob(unlabelled, "lone", 4, "completed", "2026-11-09");
    await blob(foreign, "elsewhere", 999, "completed", "2026-11-09");

    const report = await inspectRelayAccount(connection.db, {
      accountId: account,
      projectIds: ["alpha", "missing"],
      gracePeriodMs: 7 * day,
      now: new Date("2026-11-10T00:00:00Z"),
    });

    expect(report).toMatchObject({ accountId: account, gracePeriodDays: 7, absentProjectIds: ["missing"] });
    expect(report.projects.map((project) => project.projectKey).sort()).toEqual([known, unlabelled].sort());
    const alpha = report.projects.find((project) => project.projectKey === known)!;
    expect(alpha).toMatchObject({
      projectId: "alpha",
      documents: { project: 1, personal: 1 },
      updates: { count: 1, bytes: 10, covered: 0 },
      states: { count: 1, bytes: 20, replaced: 1 },
      blobs: {
        open: { count: 1, bytes: 7 },
        completed: { count: 4, bytes: 1159 },
        deleting: { count: 1, bytes: 3 },
      },
      unreferenced: {
        count: 2,
        bytes: 16,
        eligibleFrom: "2026-11-12T00:00:00.000Z",
        eligibleUntil: "2026-11-15T00:00:00.000Z",
      },
      bytes: 10 + 20 + 7 + 1159 + 3,
    });
    expect(alpha.largestDocuments).toEqual([
      { documentId: "folder-copy", space: "personal", bytes: 1020 },
      { documentId: "records", space: "project", bytes: 160 },
    ]);
    const beta = report.projects.find((project) => project.projectKey === unlabelled)!;
    expect(beta).toMatchObject({ projectId: null, unreferenced: { count: 1, bytes: 4 }, bytes: 4 });
    expect(report.bytes).toBe(alpha.bytes + beta.bytes);

    // The operator entry point reads the deployment's grace period and labels the named projects.
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
