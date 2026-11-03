import { strict as assert } from "node:assert";
import { createRelayAssets, createRelaySync, defaultRelayLimits } from "../src/index";
import { renewFixtureAccess } from "./manager.fixture";

assert.equal((await fetch(`${process.env.RELAY_URL}/health`)).status, 200);
const saved = await Bun.file("/fixture/grant.json").json();
await assert.rejects(renewFixtureAccess(saved.token, saved.scope.workbenchId));
const config = {
  databaseUrl: process.env.DATABASE_URL!,
  bucket: process.env.S3_BUCKET!,
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  },
};
const assets = createRelayAssets(config);
const sync = createRelaySync({ ...config, assets, limits: defaultRelayLimits });
try {
  const address = { projectKey: "built-storage-smoke", spaceOwner: null, documentId: "built-storage-document" };
  const state = await sync.documents.readState(address, "built-storage-state");
  assert.ok(state);
  const bytes = new Uint8Array(await new Response(state.body).arrayBuffer());
  assert.equal(bytes.length, 1024);
  const blob = await sync.blobs.read({ ...address, blobId: "built-storage-blob" }, 0);
  assert.deepEqual(new Uint8Array(await new Response(blob.body).arrayBuffer()), bytes);
  console.log("Replaced runtime containers retained encrypted state, blob bytes and device removal");
} finally {
  await Promise.all([sync.close(), assets.close()]);
}
