import { strict as assert } from "node:assert";
import {
  assetSchema,
  fingerprint,
  type RelayOperation,
  receiptSchema,
  relayAssetStatusSchema,
  relayPath,
  relayReplayResultSchema,
  sealMutation,
  snapshotSchema,
} from "pstdio-sync-contracts";

assert.equal(process.env.DATABASE_URL, undefined);
assert.equal(process.env.MANAGER_DATABASE_URL, undefined);
assert.equal(process.env.MANAGER_SERVICE_SECRET, undefined);
assert.equal(process.env.RELAY_RECOVERY_KEY_FILE, undefined);
const scope = {
  accountId: process.env.SMOKE_ACCOUNT_ID!,
  workbenchId: process.env.SMOKE_WORKBENCH_ID!,
  extensionId: "notes",
};
const token = process.env.SMOKE_ENVIRONMENT_TOKEN!;
const call = (operation: RelayOperation, body?: unknown) =>
  fetch(new URL(relayPath(scope, operation), process.env.RELAY_URL), {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const changes = new URL(relayPath(scope, "changes"), process.env.RELAY_URL);
changes.protocol = "ws:";
const ws = new WebSocket(changes, { headers: { authorization: `Bearer ${token}` } });
const ready = Promise.withResolvers<void>();
const changed = Promise.withResolvers<void>();
const closed = Promise.withResolvers<CloseEvent>();
ws.addEventListener("error", () => {
  ready.reject(new Error("Built socket failed"));
  changed.reject(new Error("Built socket failed"));
});
ws.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  assert.deepEqual(Object.keys(message).sort(), ["protocolVersion", "type"]);
  if (message.type === "ready") ready.resolve();
  if (message.type === "changed") changed.resolve();
});
ws.addEventListener("close", (event) => closed.resolve(event));
try {
  await ready.promise;
  const initial = snapshotSchema.parse(await (await call("snapshot")).json());
  const bytes = new TextEncoder().encode("built network streamed bytes");
  const asset = assetSchema.parse({
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "application/octet-stream",
  });
  const begun = await call("assets/begin", { uploadId: "network", asset });
  assert.equal(begun.status, 200);
  assert.equal(relayAssetStatusSchema.parse(await begun.json()).completed, false);
  const part = await fetch(new URL(relayPath(scope, "assets/part"), process.env.RELAY_URL), {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "x-pstdio-upload-id": "network",
      "x-pstdio-part-number": "1",
      "x-pstdio-sha256": asset.sha256,
      "content-length": String(bytes.length),
    },
    body: new Blob([bytes]).stream(),
  });
  assert.equal(part.status, 200);
  assert.deepEqual(await part.json(), {});
  assert.deepEqual(await (await call("assets/finish", { uploadId: "network" })).json(), asset);
  const mutation = await sealMutation({
    protocolVersion: 1,
    scope,
    environmentId: process.env.SMOKE_ENVIRONMENT_ID!,
    operationId: "network-group",
    parents: [],
    changes: [
      {
        recordId: "note",
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: "built network" },
      },
      { recordId: "image", expectedRevision: 0, baseDeleted: false, asset: { base: null, next: asset } },
    ],
  });
  const receipt = receiptSchema.parse(await (await call("submit", mutation)).json());
  assert.equal(receipt.status, "accepted");
  assert.match(receipt.recoveryProof!, /^[0-9a-f]{64}$/);
  assert.deepEqual(await (await call("submit", mutation)).json(), receipt);
  await changed.promise;
  const replay = relayReplayResultSchema.parse(await (await call("replay", initial.checkpoint)).json());
  assert.equal(replay.status, "replay");
  if (replay.status === "replay") assert.deepEqual(replay.batch.groups, [receipt]);
  assert.equal(snapshotSchema.parse(await (await call("snapshot")).json()).records.note!.value, "built network");
  const offset = 7;
  const suffix = await call("assets/read", { asset, offset });
  assert.equal(suffix.status, 200);
  assert.equal(suffix.headers.get("x-pstdio-offset"), String(offset));
  assert.equal(suffix.headers.get("x-pstdio-byte-length"), String(bytes.length - offset));
  const hash = new Bun.CryptoHasher("sha256").update(bytes.subarray(0, offset));
  for await (const chunk of suffix.body!) hash.update(chunk);
  assert.equal(hash.digest("hex"), asset.sha256);
  console.log("READY_FOR_REVOCATION");
  assert.equal((await closed.promise).code, 1008);
  assert.equal((await call("snapshot")).status, 401);
  console.log("Built credential-only HTTP, asset ranges, replay and expiring idle WebSocket passed");
} finally {
  ws.close();
}
