import { strict as assert } from "node:assert";
import { createRelayAssets, createRelayStorage } from "../src/index";
import { renewFixtureAccess } from "./manager.fixture";

assert.equal((await fetch(`${process.env.RELAY_URL}/health`)).status, 200);
const saved = await Bun.file("/fixture/grant.json").json();
await assert.rejects(renewFixtureAccess(saved.token, saved.scope.workbenchId));
const databaseUrl = process.env.DATABASE_URL!;
const assets = createRelayAssets({
  databaseUrl,
  bucket: process.env.S3_BUCKET!,
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  },
});
const storage = createRelayStorage(databaseUrl, assets);
try {
  const scope = { accountId: "smoke-owner", workbenchId: "built-storage-smoke", extensionId: "notes" };
  const owner = storage.owner(scope);
  const snapshot = await owner.snapshot();
  assert.equal(snapshot.records.note.value, "saved");
  const asset = snapshot.records.image.asset!;
  const stored = await assets.read(scope, asset);
  assert.ok(stored);
  const bytes = await new Response(stored.body).arrayBuffer();
  assert.equal(new Bun.CryptoHasher("sha256").update(bytes).digest("hex"), asset.sha256);
  console.log("Replaced runtime containers retained content, asset bytes and device removal");
} finally {
  await Promise.all([storage.close(), assets.close()]);
}
