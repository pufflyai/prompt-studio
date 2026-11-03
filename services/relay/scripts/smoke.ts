import { strict as assert } from "node:assert";
import { createRelayAssets, createRelaySync, defaultRelayLimits, migrateRelayStorage } from "../src/index";
import { checkBuiltTransport } from "./smoke-transport";

assert.equal((await fetch(`${process.env.RELAY_URL}/health`)).status, 200);
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
let sync = createRelaySync({ ...config, assets, limits: defaultRelayLimits });
const address = { projectKey: "built-storage-smoke", spaceOwner: null, documentId: "built-storage-document" };
const caller = { accountId: "smoke-owner", deviceId: "built-smoke" };
const bytes = crypto.getRandomValues(new Uint8Array(1024));
const update = {
  updateId: "built-storage-update",
  payload: Buffer.from(bytes).toString("base64"),
  blobIds: ["built-storage-blob"],
};
try {
  await assert.rejects(sync.documents.appendUpdate(address, caller, update));
  const blob = { ...address, blobId: "built-storage-blob" };
  await sync.blobs.begin(blob, caller, {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
  });
  await sync.blobs.writePart(blob, 1, {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    body: new Blob([bytes]).stream(),
  });
  await assert.rejects(sync.documents.appendUpdate(address, caller, update));
  await sync.blobs.finish(blob);
  assert.deepEqual(await sync.documents.appendUpdate(address, caller, update), { sequence: 1, duplicate: false });
  await sync.documents.replaceState(address, caller, {
    stateId: "built-storage-state",
    baseStateId: null,
    through: 1,
    payload: update.payload,
    summary: "AA==",
    blobIds: ["built-storage-blob"],
  });
  await sync.close();
  await assets.close();
  assets = createRelayAssets(config);
  sync = createRelaySync({ ...config, assets, limits: defaultRelayLimits });
  assert.deepEqual(await sync.documents.appendUpdate(address, caller, update), { sequence: 1, duplicate: true });
  const state = await sync.documents.readState(address, "built-storage-state");
  assert.deepEqual(new Uint8Array(await new Response(state!.body).arrayBuffer()), bytes);
  const stored = await sync.blobs.read(blob, 0);
  assert.deepEqual(new Uint8Array(await new Response(stored.body).arrayBuffer()), bytes);
  console.log(
    "Built blind storage verifies complete blobs, duplicate updates and latest-state persistence after reopen",
  );
} finally {
  await sync.close();
  await assets.close();
}
await checkBuiltTransport();
