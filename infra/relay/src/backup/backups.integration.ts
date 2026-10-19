import { afterEach, beforeEach, expect, test } from "bun:test";
import { canonicalJson, fingerprint, snapshotFingerprint } from "pstdio-sync-contracts";
import { type BackupFixture, createBackupFixture } from "./integration-fixture";

let f: BackupFixture;
beforeEach(async () => {
  f = await createBackupFixture();
});
afterEach(async () => {
  await f?.close();
});

test("hourly backups publish independently verified durable coverage for real records and packages", async () => {
  const populated = await f.populate();
  const snapshot = await populated.owner.snapshot();
  let worker = f.worker();
  const catalog = f.catalog();
  const now = Date.now();
  await worker.tick(now);
  const verified = await catalog.readCoverage(now);
  expect(verified.state).toBe("verified");
  const denied = await fetch(`${process.env.SYNC_TEST_OBJECT_ENDPOINT}/${f.backup.bucket}/${verified.backup!.key}`);
  expect(denied.status).toBe(403);
  await denied.text();
  expect(verified.coverage).toContainEqual({
    scope: populated.scope,
    epoch: snapshot.checkpoint.epoch,
    generation: snapshot.generation,
    cut: snapshot.checkpoint.sequence,
    snapshotHash: await snapshotFingerprint(snapshot),
    manifestHash: verified.backup!.asset.sha256,
  });
  expect(await f.pins()).toHaveLength(0);
  const copies = await f.list(f.backup.bucket, "objects/");
  expect(copies).toHaveLength(2);
  await worker.close();
  worker = f.worker();
  await worker.tick(now + 3_599_999);
  expect(await f.list(f.backup.bucket, "complete/")).toHaveLength(1);
  await worker.tick(now + 3_600_000);
  expect(await f.list(f.backup.bucket, "complete/")).toHaveLength(2);
  expect(await f.list(f.backup.bucket, "objects/")).toEqual(copies);
  await worker.close();
  const reopened = f.catalog();
  expect((await reopened.readCoverage(now + 3_600_001)).state).toBe("verified");
  expect((await reopened.readCoverage(now + 7_200_001)).state).toBe("stale");
  expect((await reopened.readCoverage(now + 7_200_001)).coverage).toEqual([]);
  expect(canonicalJson(verified.coverage)).not.toContain("recoveryProof");
  expect(await fingerprint(snapshot)).toBe(await snapshotFingerprint(snapshot));
});

test("older retained backups reconstruct content after losing the live database and bucket", async () => {
  const { publishedExtensionsId } = await import("pstdio-sync-contracts");
  const { sealStoredMutation } = await import("../storage/mutation.fixture");
  const { assetBytes } = await import("./integration-fixture");
  const populated = await f.populate();
  const first = await populated.owner.snapshot();
  await populated.owner.acknowledge(
    {
      protocolVersion: 2,
      scope: populated.scope,
      epoch: first.checkpoint.epoch,
      generation: first.generation,
      environmentId: "writer",
      cut: first.checkpoint.sequence,
      snapshotHash: await snapshotFingerprint(first),
      branches: [],
      recovery: [],
    },
    "writer",
  );
  const worker = f.worker();
  const catalog = f.catalog();
  const now = Date.now();
  await worker.tick(now);
  const older = (await catalog.readCoverage(now)).backup!;
  const next = await f.put(populated.scope, new Uint8Array(2000).fill(123));
  await populated.owner.submit(
    await sealStoredMutation({
      protocolVersion: 2,
      scope: populated.scope,
      operationId: "next",
      environmentId: "writer",
      parents: [],
      changes: [
        {
          recordId: "record",
          expectedRevision: first.records.record.revision,
          baseDeleted: false,
          asset: { base: populated.asset, next },
        },
      ],
    }),
  );
  await worker.tick(now + 3_600_000);
  const latest = (await catalog.readCoverage(now + 3_600_000)).backup!;
  expect(
    (await catalog.open(latest)).manifests
      .find((m) => m.capture.snapshot.scope.extensionId === populated.scope.extensionId)!
      .capture.references.some((ref) => ref.asset.sha256 === populated.asset.sha256),
  ).toBe(true);
  await f.removeLive();
  await f.pool.query("TRUNCATE relay_scopes, relay_asset_uploads, relay_asset_parts, relay_verified_assets CASCADE");
  const restored = await catalog.open(older);
  const seen = new Set<string>();
  for (const entry of restored.manifests) {
    for (const ref of entry.capture.references) {
      const key = canonicalJson([ref.scope, ref.asset]);
      if (seen.has(key)) continue;
      seen.add(key);
      expect(await f.put(ref.scope, await assetBytes(await restored.read(ref.asset)), ref.asset.mediaType)).toEqual(
        ref.asset,
      );
    }
  }
  const ordered = [...restored.manifests].sort(
    (a, b) =>
      Number(b.capture.snapshot.scope.extensionId === publishedExtensionsId) -
      Number(a.capture.snapshot.scope.extensionId === publishedExtensionsId),
  );
  for (const entry of ordered) {
    const snapshot = entry.capture.snapshot;
    const owner = await f.storage.initialize(snapshot.scope, snapshot.publishedRevision);
    await owner.restore(snapshot);
  }
  const actual = await f.storage.owner(populated.scope).snapshot();
  expect(actual.records).toEqual(first.records);
  expect(actual.checkpoint.epoch).not.toBe(first.checkpoint.epoch);
  expect(actual.publishedRevision).toBe(populated.packageAsset.sha256);
  const packageRead = await f.assets.read(populated.catalogScope, populated.packageAsset);
  expect(await assetBytes(packageRead!.body)).toEqual(populated.packageBytes);
  expect(
    restored.manifests.find((m) => m.capture.snapshot.scope.extensionId === populated.scope.extensionId)!.coverage,
  ).toHaveLength(1);
  expect((await catalog.open(latest)).manifests).toHaveLength(2);
});

test("a corrupted independent copy cannot publish retention coverage or restore", async () => {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { copyKey } = await import("./objects");
  const populated = await f.populate();
  const now = Date.now();
  await f.worker().tick(now);
  const catalog = f.catalog();
  const backup = (await catalog.readCoverage(now)).backup!;
  await f.base.client.send(
    new PutObjectCommand({
      Bucket: f.backup.bucket,
      Key: await copyKey(populated.asset),
      Body: new Uint8Array(populated.asset.byteLength).fill(90),
      ContentType: populated.asset.mediaType,
    }),
  );
  expect((await catalog.readCoverage(now)).state).toBe("failed");
  expect((await catalog.readCoverage(now)).coverage).toEqual([]);
  await expect(catalog.open(backup)).rejects.toThrow();
});

test("pending and conflicting recovery bytes are retained without claiming accepted coverage", async () => {
  const { sealStoredMutation } = await import("../storage/mutation.fixture");
  const { assetBytes } = await import("./integration-fixture");
  const populated = await f.populate();
  const alternative = await f.put(populated.scope, new Uint8Array(500).fill(42));
  const pendingAsset = await f.put(populated.scope, new Uint8Array(600).fill(43));
  for (const [operationId, asset, parents] of [
    ["conflict", alternative, []],
    ["pending", pendingAsset, ["conflict"]],
  ] as const) {
    await populated.owner.submit(
      await sealStoredMutation({
        protocolVersion: 2,
        scope: populated.scope,
        operationId,
        environmentId: "alternative",
        parents: [...parents],
        changes: [
          {
            recordId: "record",
            expectedRevision: 0,
            baseDeleted: false,
            value: { expected: await fingerprint(null), next: "alternative" },
            asset: { base: null, next: asset },
          },
        ],
      }),
    );
  }
  const now = Date.now();
  await f.worker().tick(now);
  const verified = await f.catalog().readCoverage(now);
  expect(verified.state).toBe("verified");
  const saved = await f.catalog().open(verified.backup!);
  const entry = saved.manifests.find((m) => m.capture.snapshot.scope.extensionId === populated.scope.extensionId)!;
  expect(entry.capture.snapshot.receipts.conflict.status).toBe("conflict");
  expect(entry.capture.snapshot.receipts.pending.status).toBe("pending");
  expect(entry.capture.snapshot.retainedBranches.sort()).toEqual(["conflict", "pending"]);
  expect(verified.coverage.find((coverage) => coverage.scope.extensionId === populated.scope.extensionId)!.cut).toBe(1);
  expect(await assetBytes(await saved.read(pendingAsset))).toEqual(new Uint8Array(600).fill(43));
  expect(await f.list(f.backup.bucket, "objects/")).toHaveLength(4);
});

test("capture pins preserve a consistent publication while another worker declines the lease", async () => {
  const { sealStoredMutation } = await import("../storage/mutation.fixture");
  const populated = await f.populate();
  const before = await populated.owner.snapshot();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let gated = false;
  const endpoint = process.env.SYNC_TEST_OBJECT_ENDPOINT!;
  const proxy = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const response = await fetch(endpoint + url.pathname + url.search, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: request.signal,
      });
      if (request.method !== "GET" || gated) return response;
      gated = true;
      entered.resolve();
      await release.promise;
      return response;
    },
  });
  const first = f.worker({
    ...f.config,
    live: {
      ...f.config.live,
      s3: { ...f.config.live.s3, endpoint: proxy.url.href },
    },
  });
  const now = Date.now();
  const running = first.tick(now);
  try {
    await Promise.race([
      entered.promise,
      running.then(() => {
        throw new Error("Capture did not enter streaming");
      }),
    ]);
    const pins = await f.pins();
    expect(pins).toHaveLength(2);
    expect(
      pins.some((pin) =>
        pin.references.some((ref: { asset: { sha256: string } }) => ref.asset.sha256 === populated.packageAsset.sha256),
      ),
    ).toBe(true);
    await f.worker().tick(now);
    expect((await f.pins()).map((pin) => pin.id).sort()).toEqual(pins.map((pin) => pin.id).sort());
    const changedPackage = new TextEncoder().encode(
      JSON.stringify({
        ...JSON.parse(new TextDecoder().decode(populated.packageBytes)),
        revisionNote: "new publication",
      }),
    );
    const packageAsset = await f.put(populated.catalogScope, changedPackage, populated.packageAsset.mediaType);
    const catalog = f.storage.owner(populated.catalogScope);
    const catalogSnapshot = await catalog.snapshot();
    const record = catalogSnapshot.records[populated.scope.extensionId]!;
    await catalog.submit(
      await sealStoredMutation({
        protocolVersion: 2,
        scope: populated.catalogScope,
        operationId: "second-publication",
        environmentId: "publisher",
        parents: [],
        changes: [
          {
            recordId: populated.scope.extensionId,
            expectedRevision: record.revision,
            baseDeleted: false,
            value: {
              expected: await fingerprint(record.value),
              next: {
                extensionId: populated.scope.extensionId,
                revision: packageAsset.sha256,
                automation: false,
                enabled: true,
              },
            },
            asset: { base: populated.packageAsset, next: packageAsset },
          },
        ],
      }),
    );
    release.resolve();
    await running;
    const verified = await f.catalog().readCoverage(now);
    const saved = await f.catalog().open(verified.backup!);
    const captured = saved.manifests.find((m) => m.capture.snapshot.scope.extensionId === populated.scope.extensionId)!;
    expect(captured.capture.snapshotHash).toBe(await snapshotFingerprint(before));
    expect(captured.capture.snapshot.publishedRevision).toBe(populated.packageAsset.sha256);
    expect((await populated.owner.snapshot()).publishedRevision).toBe(packageAsset.sha256);
    expect(await f.pins()).toHaveLength(0);
  } finally {
    release.resolve();
    await running.catch(() => {});
    await proxy.stop(true);
  }
});
