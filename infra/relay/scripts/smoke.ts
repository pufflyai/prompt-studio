import { strict as assert } from "node:assert";
import { S3Client } from "bun";
import { canonicalJson, fingerprint, sealMutation } from "pstdio-sync-contracts";
import { createRelayStorage, migrateRelayStorage } from "../src/index";

const response = await fetch(`${process.env.RELAY_URL}/health`);
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { status: "ok" });
console.log("Built relay liveness passed");

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  virtualHostedStyle: false,
});
const key = `smoke/${crypto.randomUUID()}`;
const bytes = crypto.getRandomValues(new Uint8Array(1024));
try {
  await s3.write(key, bytes);
  assert.equal(await s3.exists(key), true);
  assert.deepEqual(new Uint8Array(await s3.file(key).arrayBuffer()), bytes);
} finally {
  await s3.delete(key);
}
assert.equal(await s3.exists(key), false);
console.log("Disposable S3 byte round trip and deletion passed");

const scope = { accountId: "smoke-owner", workbenchId: crypto.randomUUID(), extensionId: "notes" };
const asset = {
  sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
  byteLength: bytes.length,
  mediaType: "image/png",
};
const assetKey = `smoke/${scope.workbenchId}/${asset.sha256}`;
const databaseUrl = process.env.DATABASE_URL!;
await migrateRelayStorage(databaseUrl, "/app/drizzle");
const assets = {
  async complete(input: typeof scope, reference: typeof asset) {
    assert.equal(canonicalJson(input), canonicalJson(scope));
    const stored = new Uint8Array(await s3.file(assetKey).arrayBuffer());
    return (
      stored.length === reference.byteLength &&
      new Bun.CryptoHasher("sha256").update(stored).digest("hex") === reference.sha256
    );
  },
};
await s3.write(assetKey, bytes);
let storage = createRelayStorage(databaseUrl, assets);
try {
  const owner = await storage.initialize(scope, "published-smoke-1");
  const mutation = await sealMutation({
    protocolVersion: 1,
    scope,
    operationId: crypto.randomUUID(),
    environmentId: "built-smoke",
    parents: [],
    changes: [
      {
        recordId: "note",
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: "saved" },
      },
      { recordId: "image", expectedRevision: 0, baseDeleted: false, asset: { base: null, next: asset } },
    ],
  });
  const receipt = await owner.submit(mutation);
  assert.equal(receipt.status, "accepted");
  await storage.close();
  storage = createRelayStorage(databaseUrl, assets);
  const reopened = storage.owner(scope);
  assert.deepEqual(await reopened.submit(mutation), receipt);
  const snapshot = await reopened.snapshot();
  assert.equal(snapshot.records.note.value, "saved");
  assert.deepEqual(snapshot.records.image.asset, asset);
  const replay = await reopened.replay({ epoch: snapshot.checkpoint.epoch, sequence: 0 });
  assert.equal(replay.status, "replay");
  if (replay.status === "replay") assert.deepEqual(replay.batch.groups, [receipt]);
  console.log("Built production PostgreSQL publication, restart receipt, snapshot and replay passed");
} finally {
  await storage.close();
  await s3.delete(assetKey);
}
