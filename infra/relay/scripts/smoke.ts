import { strict as assert } from "node:assert";
import { fingerprint, sealMutation } from "pstdio-sync-contracts";
import { createRelayAssets, createRelayStorage, migrateRelayStorage } from "../src/index";
import { checkBuiltTransport } from "./smoke-transport";

const response = await fetch(`${process.env.RELAY_URL}/health`);
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { status: "ok" });
console.log("Built relay liveness passed");

const bytes = crypto.getRandomValues(new Uint8Array(1024));

const scope = { accountId: "smoke-owner", workbenchId: crypto.randomUUID(), extensionId: "notes" };
const asset = {
  sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
  byteLength: bytes.length,
  mediaType: "image/png",
};
const databaseUrl = process.env.DATABASE_URL!;
await migrateRelayStorage(databaseUrl, "/app/drizzle");
const config = {
  databaseUrl,
  bucket: process.env.S3_BUCKET!,
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  },
};
let assets = createRelayAssets(config);
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
  assert.equal((await owner.submit(mutation)).status, "pending");
  assert.deepEqual((await owner.snapshot()).records, {});
  await assets.begin(scope, "built-smoke", asset);
  await assets.writePart(scope, "built-smoke", 1, { ...asset, body: new Blob([bytes]).stream() });
  assert.equal(await assets.complete(scope, asset), false);
  await assets.finish(scope, "built-smoke");
  const receipt = await owner.submit(mutation);
  assert.equal(receipt.status, "accepted");
  await storage.close();
  await assets.close();
  assets = createRelayAssets(config);
  storage = createRelayStorage(databaseUrl, assets);
  const reopened = storage.owner(scope);
  assert.deepEqual(await reopened.submit(mutation), receipt);
  const snapshot = await reopened.snapshot();
  assert.equal(snapshot.records.note.value, "saved");
  assert.deepEqual(snapshot.records.image.asset, asset);
  const replay = await reopened.replay({ epoch: snapshot.checkpoint.epoch, sequence: 0 });
  assert.equal(replay.status, "replay");
  if (replay.status === "replay") assert.deepEqual(replay.batch.groups, [receipt]);
  const stored = await assets.read(scope, asset);
  assert.deepEqual(stored?.asset, asset);
  const hash = new Bun.CryptoHasher("sha256");
  let length = 0;
  for await (const chunk of stored!.body) {
    hash.update(chunk);
    length += chunk.byteLength;
  }
  assert.equal(hash.digest("hex"), asset.sha256);
  assert.equal(length, asset.byteLength);
  await assets.cancel(scope, "built-smoke");
  assert.equal(await assets.complete(scope, asset), true);
  console.log("Built production PostgreSQL and S3 streaming publication, restart receipt, snapshot and replay passed");
} finally {
  await storage.close();
  await assets.close();
}
await checkBuiltTransport();
