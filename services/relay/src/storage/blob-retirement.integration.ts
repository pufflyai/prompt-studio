import { afterAll, beforeAll, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { blobRetirementPage } from "./blob-retirement";
import { type RetirementPlan, retirementPlanNodes, seedRetirementGraph } from "./blob-retirement.fixture";
import { connectRelay } from "./database";
import { body, createSyncFixture, encode, randomId, sha256 } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("retirement pages skip retained prefixes without traversing their descendant graph", async () => {
  const connection = connectRelay(fixture.databaseUrl);
  try {
    const { accountId, projectKey } = await seedRetirementGraph((query) => connection.db.execute(query), 10_000);
    const query = blobRetirementPage(accountId, new Date("2021-01-01"), { projectKey, blobId: "a-retained-010000" });
    const result = await connection.db.execute<{ "QUERY PLAN": { Plan: RetirementPlan }[] }>(
      sql`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`,
    );
    const nodes = retirementPlanNodes(result.rows[0]!["QUERY PLAN"][0]!.Plan);
    expect(nodes.some((node) => node["Node Type"] === "Recursive Union")).toBe(false);
    const scans = nodes.filter(
      (node) =>
        ["relay_sync_blobs", "relay_sync_updates", "relay_sync_states"].includes(node["Relation Name"] ?? "") &&
        node["Node Type"].includes("Scan"),
    );
    const visited = scans.reduce(
      (total, node) =>
        total +
        ((node["Actual Rows"] ?? 0) +
          (node["Rows Removed by Filter"] ?? 0) +
          (node["Rows Removed by Index Recheck"] ?? 0)) *
          (node["Actual Loops"] ?? 1),
      0,
    );
    expect(visited).toBeLessThanOrEqual(1500);
    const page = await connection.db.execute<{ projectKey: string; blobId: string; retire: boolean }>(query);
    expect(page.rows).toHaveLength(500);
    expect(page.rows.every((row) => row.projectKey === projectKey && row.retire)).toBe(true);
    expect(page.rows[0]!.blobId).toBe("z-expired-000001");
    const retained = await connection.db.execute<{ projectKey: string; blobId: string; retire: boolean }>(
      blobRetirementPage(accountId, new Date("2021-01-01"), { projectKey, blobId: "" }),
    );
    expect(retained.rows).toHaveLength(500);
    expect(retained.rows.every((row) => !row.retire)).toBe(true);
    const following = await connection.db.execute<{ blobId: string }>(
      blobRetirementPage(accountId, new Date("2021-01-01"), retained.rows.at(-1)!),
    );
    expect(following.rows[0]!.blobId).toBe("a-retained-000501");
  } finally {
    await connection.close();
  }
});

test("one cleanup retires child-before-parent chains while retained descendants remain readable", async () => {
  const { sync } = fixture.open({ gracePeriodMs: 86_400_000 });
  const owner = { projectKey: randomId("project"), spaceOwner: null };
  const caller = { accountId: randomId("account"), deviceId: randomId("device") };
  const bytes = new Uint8Array([1, 2, 3]);
  const input = { sha256: sha256(bytes), byteLength: bytes.length };
  const upload = async (blobId: string, children: string[] = []) => {
    const address = { ...owner, blobId };
    await sync.blobs.beginManifest(address, caller, { ...input, children });
    await sync.blobs.writePart(address, 1, { ...input, body: body(bytes) });
    await sync.blobs.finish(address);
    return address;
  };
  const leaf = await upload("a-expired-leaf-0123456789abcdef");
  const branch = await upload("m-expired-branch-0123456789abcdef", [leaf.blobId]);
  const root = await upload("z-expired-root-0123456789abcdef", [branch.blobId]);
  const retainedLeaf = await upload("a-retained-leaf-0123456789abcdef");
  const retainedRoot = await upload("z-retained-root-0123456789abcdef", [retainedLeaf.blobId]);
  await sync.documents.appendUpdate({ ...owner, documentId: randomId("doc") }, caller, {
    updateId: randomId("update"),
    payload: encode(bytes),
    blobIds: [retainedRoot.blobId],
  });
  await sync.cleanup(new Date(Date.now() + 2 * 86_400_000));
  for (const address of [leaf, branch, root])
    expect(await sync.blobs.read(address, 0).catch((error: unknown) => error)).toMatchObject({ status: 404 });
  for (const address of [retainedRoot, retainedLeaf]) expect((await sync.blobs.read(address, 0)).byteLength).toBe(3);
});

test("new parent publication and retirement cannot expose a missing child", async () => {
  const { sync } = fixture.open({ gracePeriodMs: 86_400_000 });
  const owner = { projectKey: randomId("project"), spaceOwner: null };
  const caller = { accountId: randomId("account"), deviceId: randomId("device") };
  const child = { ...owner, blobId: randomId("child") };
  const parent = { ...owner, blobId: randomId("parent") };
  const bytes = new Uint8Array([1]);
  const input = { sha256: sha256(bytes), byteLength: 1 };
  await sync.blobs.begin(child, caller, input);
  await sync.blobs.writePart(child, 1, { ...input, body: body(bytes) });
  await sync.blobs.finish(child);
  const connection = connectRelay(fixture.databaseUrl);
  try {
    await connection.db.execute(
      sql`UPDATE relay_sync_blobs SET "completedAt"='2020-01-01' WHERE "projectKey"=${owner.projectKey} AND "blobId"=${child.blobId}`,
    );
    const [publication, cleanup] = await Promise.allSettled([
      sync.blobs.beginManifest(parent, caller, { ...input, children: [child.blobId] }),
      sync.cleanup(),
    ]);
    expect(cleanup.status).toBe("fulfilled");
    if (publication.status === "fulfilled") expect((await sync.blobs.read(child, 0)).byteLength).toBe(1);
    else {
      expect(publication.reason).toMatchObject({ status: 409 });
      expect(await sync.blobs.read(child, 0).catch((error: unknown) => error)).toMatchObject({ status: 404 });
    }
  } finally {
    await connection.close();
  }
});
