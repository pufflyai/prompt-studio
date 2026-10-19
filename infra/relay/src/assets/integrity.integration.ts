import { afterAll, beforeAll, expect, test } from "bun:test";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { fingerprint } from "pstdio-sync-contracts";
import { sealStoredMutation as sealMutation } from "../storage/mutation.fixture";
import { createRelayStorage } from "../storage/storage";
import { createRelayAssets } from "./assets";
import { createAssetFixture, input, newScope, reference } from "./integration-fixture";

const fixture = createAssetFixture();
let assets = fixture.owner();
beforeAll(() => fixture.initialize());
afterAll(async () => {
  await assets.close();
  fixture.close();
});

test("empty assets use the same verified publication boundary", async () => {
  const scope = newScope();
  const asset = reference(new Uint8Array());
  await assets.begin(scope, "empty", asset);
  expect(await assets.complete(scope, asset)).toBe(false);
  expect(await assets.finish(scope, "empty")).toEqual(asset);
  const read = await assets.read(scope, asset);
  expect(await new Response(read!.body).text()).toBe("");
  const wrong = { ...asset, sha256: "0".repeat(64) };
  await assets.begin(scope, "wrong-empty", wrong);
  await expect(assets.finish(scope, "wrong-empty")).rejects.toThrow("mismatch");
  expect(await assets.complete(scope, wrong)).toBe(false);
});

test("truncated and corrupt transfers retain their immutable intent for a correct retry", async () => {
  const scope = newScope();
  const bytes = new TextEncoder().encode("correct image bytes");
  const asset = reference(bytes);
  for (const [id, broken] of [
    ["truncated", bytes.subarray(0, 2)],
    ["corrupt", new Uint8Array(bytes.length).fill(1)],
  ] as const) {
    await assets.begin(scope, id, asset);
    await expect(
      assets.writePart(scope, id, 1, { ...input(broken), sha256: asset.sha256, byteLength: asset.byteLength }),
    ).rejects.toThrow();
    expect(await assets.complete(scope, asset)).toBe(false);
    await expect(assets.finish(scope, id)).rejects.toThrow("incomplete");
    const resumed = await assets.begin(scope, id, asset);
    expect(resumed.parts[0].etag).toBeNull();
    await assets.writePart(scope, id, 1, input(bytes));
    await assets.finish(scope, id);
    expect(await assets.complete(scope, asset)).toBe(true);
    // A separate scope keeps the second corrupt transfer unpublishable too.
    scope.workbenchId = crypto.randomUUID();
  }
});

test("the full durable digest is verified independently of valid multipart checksums", async () => {
  const scope = newScope();
  const bytes = new TextEncoder().encode("correct");
  const asset = reference(bytes);
  const wrong = new TextEncoder().encode("changed");
  await assets.begin(scope, "wrong-full-digest", asset);
  await assets.writePart(scope, "wrong-full-digest", 1, input(wrong));
  await expect(assets.finish(scope, "wrong-full-digest")).rejects.toThrow("mismatch");
  expect(await assets.complete(scope, asset)).toBe(false);
  await assets.begin(scope, "correct", asset);
  await assets.writePart(scope, "correct", 1, input(bytes));
  await assets.finish(scope, "correct");
  await assets.cancel(scope, "wrong-full-digest");
  expect(await assets.complete(scope, asset)).toBe(true);
  expect(await new Response((await assets.read(scope, asset))!.body).text()).toBe("correct");
});

test("a changed durable object cannot satisfy a previously verified asset reference", async () => {
  const scope = newScope();
  const bytes = new TextEncoder().encode("verified");
  const asset = reference(bytes);
  await assets.begin(scope, "corrupted-outside-owner", asset);
  await assets.writePart(scope, "corrupted-outside-owner", 1, input(bytes));
  await assets.finish(scope, "corrupted-outside-owner");
  const key = `assets/${await fingerprint(scope)}/${await fingerprint("corrupted-outside-owner")}`;
  await fixture.client.send(
    new PutObjectCommand({ Bucket: fixture.config.bucket, Key: key, Body: new Uint8Array(bytes.length).fill(1) }),
  );
  expect(await assets.complete(scope, asset)).toBe(false);
  expect(await assets.read(scope, asset)).toBeNull();
  await expect(assets.finish(scope, "corrupted-outside-owner")).rejects.toThrow("incomplete");
  await assets.begin(scope, "recovered-by-new-upload", asset);
  await assets.writePart(scope, "recovered-by-new-upload", 1, input(bytes));
  await assets.finish(scope, "recovered-by-new-upload");
  expect(await assets.complete(scope, asset)).toBe(true);
  expect(await new Response((await assets.read(scope, asset))!.body).text()).toBe("verified");
});

test("denied object access leaves recoverable intent without a completion acknowledgment", async () => {
  const scope = newScope();
  const bytes = new TextEncoder().encode("denied write");
  const asset = reference(bytes);
  const denied = createRelayAssets({
    ...fixture.config,
    s3: { ...fixture.config.s3, credentials: { accessKeyId: "ungranted", secretAccessKey: "invalid-test-secret" } },
  });
  try {
    await expect(denied.begin(scope, "denied", asset)).rejects.toThrow();
    expect(await assets.complete(scope, asset)).toBe(false);
    await assets.begin(scope, "denied", asset);
    await assets.writePart(scope, "denied", 1, input(bytes));
    await assets.finish(scope, "denied");
    expect(await assets.complete(scope, asset)).toBe(true);
    await expect(denied.complete(scope, asset)).rejects.toThrow();
    await expect(denied.read(scope, asset)).rejects.toThrow();
    const storage = createRelayStorage(fixture.config.databaseUrl, denied);
    const retry = createRelayStorage(fixture.config.databaseUrl, assets);
    try {
      const owner = await storage.initialize(scope, "published-images-1");
      const mutation = await sealMutation({
        protocolVersion: 2,
        scope,
        operationId: crypto.randomUUID(),
        environmentId: "denied-test",
        parents: [],
        changes: [
          {
            recordId: "note",
            expectedRevision: 0,
            baseDeleted: false,
            value: { expected: await fingerprint(null), next: "retained" },
          },
          { recordId: "image", expectedRevision: 0, baseDeleted: false, asset: { base: null, next: asset } },
        ],
      });
      await expect(owner.submit(mutation)).rejects.toThrow();
      const failed = await owner.snapshot();
      expect(failed.records).toEqual({});
      expect(failed.receipts).toEqual({});
      expect(failed.journalSequence).toBe(0);
      expect((await retry.owner(scope).submit(mutation)).status).toBe("accepted");
    } finally {
      await storage.close();
      await retry.close();
    }
  } finally {
    await denied.close();
  }
});

test("real object completion releases a whole record group and remains required by historical restore", async () => {
  const scope = newScope();
  const bytes = new TextEncoder().encode("group image");
  const asset = reference(bytes);
  let storage = createRelayStorage(fixture.config.databaseUrl, assets);
  try {
    const owner = await storage.initialize(scope, "published-images-1");
    const mutation = await sealMutation({
      protocolVersion: 2,
      scope,
      operationId: crypto.randomUUID(),
      environmentId: "asset-test",
      parents: [],
      changes: [
        {
          recordId: "note",
          expectedRevision: 0,
          baseDeleted: false,
          value: { expected: await fingerprint(null), next: "whole group" },
        },
        { recordId: "image", expectedRevision: 0, baseDeleted: false, asset: { base: null, next: asset } },
      ],
    });
    const pending = await owner.submit(mutation);
    expect(pending.status).toBe("pending");
    expect((await owner.snapshot()).records).toEqual({});
    await assets.begin(scope, "group", asset);
    await assets.writePart(scope, "group", 1, input(bytes));
    expect((await owner.submit(mutation)).status).toBe("pending");
    await assets.finish(scope, "group");
    const receipt = await owner.submit(mutation);
    expect(receipt.status).toBe("accepted");
    expect(receipt.order).toBe(pending.order);
    await storage.close();
    await assets.close();
    assets = fixture.owner();
    storage = createRelayStorage(fixture.config.databaseUrl, assets);
    const reopened = storage.owner(scope);
    expect(await reopened.submit(mutation)).toEqual(receipt);
    const saved = await reopened.snapshot();
    expect(saved.records.note.value).toBe("whole group");
    expect(saved.records.image.asset).toEqual(asset);
    await reopened.restore(saved);
    const before = await reopened.snapshot();
    const key = `assets/${await fingerprint(scope)}/${await fingerprint("group")}`;
    await fixture.client.send(
      new PutObjectCommand({ Bucket: fixture.config.bucket, Key: key, Body: "missing original bytes" }),
    );
    await expect(reopened.restore(saved)).rejects.toThrow("incomplete assets");
    expect(await reopened.snapshot()).toEqual(before);
  } finally {
    await storage.close();
  }
});
