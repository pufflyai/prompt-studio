import { afterAll, beforeAll, expect, test } from "bun:test";
import { reconstructSnapshot } from "pstdio-sync";
import { createRelayAdapter } from "pstdio-sync/relay";
import {
  type Change,
  fingerprint,
  publishedExtensionsId,
  sealMutation,
  snapshotFingerprint,
} from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { withFixtureDatabase } from "./database.fixture";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("authenticated capture and its tail reconstruct generic groups, conflicts and immutable package identity", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const controller = new AbortController();
  const adapter = (extensionId: string) =>
    createRelayAdapter({
      origin: server.url.origin,
      scope: { ...context.scope, extensionId },
      token: async () => context.token,
      signal: controller.signal,
    });
  const records = adapter(context.scope.extensionId);
  const catalog = adapter(publishedExtensionsId);
  const put = async (target: typeof records, text: string) => {
    const bytes = new TextEncoder().encode(text);
    const asset = {
      sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
      byteLength: bytes.length,
      mediaType: "application/octet-stream",
    };
    await target.assets.put(asset, async () => new Blob([bytes]).stream());
    return asset;
  };
  const group = async (target: typeof records, operationId: string, sequence: number, changes: Change[]) => {
    const snapshot = await target.snapshot();
    return sealMutation({
      protocolVersion: 2,
      scope: target.scope,
      epoch: snapshot.checkpoint.epoch,
      generation: snapshot.generation,
      environmentId: context.environmentId,
      operationId,
      sequence,
      parents: [],
      changes,
    });
  };
  try {
    await catalog.initialize("published-catalog");
    const packageOne = await put(catalog, "immutable package one");
    const packageTwo = await put(catalog, "immutable package two");
    const image = await put(records, "current asset");
    const publication = (asset: typeof image, revision: number, base: typeof image | null) => ({
      recordId: context.scope.extensionId,
      expectedRevision: revision,
      baseDeleted: false,
      value: {
        expected: "",
        next: { extensionId: context.scope.extensionId, revision: asset.sha256, automation: false, enabled: true },
      },
      asset: { base, next: asset },
    });
    const first = publication(packageOne, 0, null);
    first.value.expected = await fingerprint(null);
    expect((await catalog.submit(await group(catalog, "package-one", 1, [first]))).status).toBe("accepted");
    const seed = await group(records, "seed", 1, [
      {
        recordId: "scalar",
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: "one" },
      },
      {
        recordId: "map",
        expectedRevision: 0,
        baseDeleted: false,
        shared: {
          kind: "map",
          entries: [
            {
              key: "key",
              expected: await fingerprint({ exists: false, value: null }),
              next: { kind: "set", value: "first" },
            },
          ],
        },
      },
      { recordId: "image", expectedRevision: 0, baseDeleted: false, asset: { base: null, next: image } },
    ]);
    expect((await records.submit(seed)).status).toBe("accepted");
    const captured = await records.capture();
    expect(captured.references).toContainEqual({ kind: "package", scope: catalog.scope, asset: packageOne });
    const second = publication(packageTwo, 1, packageOne);
    second.value.expected = await fingerprint(first.value.next);
    const publish = catalog.submit(await group(catalog, "package-two", 2, [second]));
    const concurrent = records.capture();
    const [published, boundary] = await Promise.all([publish, concurrent]);
    expect(published.status).toBe("accepted");
    const packageReference = boundary.references.find((reference) => reference.kind === "package")!;
    expect(packageReference.asset.sha256).toBe(boundary.snapshot.publishedRevision);
    expect([packageOne.sha256, packageTwo.sha256]).toContain(boundary.snapshot.publishedRevision);
    const conflict = await group(records, "conflict", 2, seed.changes);
    expect((await records.submit(conflict)).status).toBe("conflict");
    const imageTwo = await put(records, "replacement current asset");
    const update = await group(records, "update", 3, [
      {
        recordId: "scalar",
        expectedRevision: 1,
        baseDeleted: false,
        value: { expected: await fingerprint("one"), next: "two" },
      },
      {
        recordId: "map",
        expectedRevision: 1,
        baseDeleted: false,
        shared: {
          kind: "map",
          entries: [
            {
              key: "key",
              expected: await fingerprint({ exists: true, value: "first" }),
              next: { kind: "set", value: "second" },
            },
          ],
        },
      },
      { recordId: "image", expectedRevision: 1, baseDeleted: false, asset: { base: image, next: imageTwo } },
    ]);
    const accepted = await records.submit(update);
    expect(accepted.status).toBe("accepted");
    expect(await records.submit(update)).toEqual(accepted);
    const tail = await records.replay(captured.snapshot.checkpoint);
    if (tail.status !== "replay") throw new Error("Expected an uncovered tail");
    const reconstructed = await reconstructSnapshot(captured.snapshot, tail.batch);
    expect(await snapshotFingerprint(reconstructed)).toBe(await snapshotFingerprint(await records.snapshot()));
    for (const receipt of Object.values(reconstructed.receipts)) expect(receipt).not.toHaveProperty("recoveryProof");
    expect(reconstructed.publishedRevision).toBe(packageTwo.sha256);
    expect(reconstructed.records.scalar.value).toBe("two");
    expect(reconstructed.records.map.map.key).toBe("second");
    expect(reconstructed.records.image.asset).toEqual(imageTwo);
    expect(reconstructed.conflicts.conflict.alternativeOperationIds).toEqual(["conflict"]);
    await withFixtureDatabase(fixture.relayDatabaseUrl, async (client) => {
      const pins = await client.query("SELECT * FROM relay_captures WHERE id=$1", [captured.id]);
      expect(pins.rows[0].references).toEqual(captured.references);
    });
    await records.releaseCapture(captured.id);
    await records.releaseCapture(boundary.id);
  } finally {
    controller.abort();
    await server.stop(true);
    await context.close();
  }
});
