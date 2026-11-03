import { strict as assert } from "node:assert";
import {
  blobStatusSchema,
  liveProtocolHeader,
  liveProtocolVersion,
  liveServerMessageSchema,
  readResultSchema,
  type SyncRoute,
  syncPath,
  syncProtocolHeader,
  syncProtocolVersion,
  updateResultSchema,
} from "pstdio-sync-contracts";

assert.equal(process.env.DATABASE_URL, undefined);
assert.equal(process.env.MANAGER_DATABASE_URL, undefined);
const projectId = process.env.SMOKE_WORKBENCH_ID!;
const token = process.env.SMOKE_ENVIRONMENT_TOKEN!;
const controller = new AbortController();
// The built fixture uses an internal HTTP-only network. Production client HTTPS policy stays unchanged.
const request = async (route: SyncRoute, body: unknown, method = "POST", headers: Record<string, string> = {}) => {
  const response = await fetch(new URL(syncPath(route), process.env.RELAY_URL), {
    method,
    signal: controller.signal,
    headers: { authorization: `Bearer ${token}`, [syncProtocolHeader]: String(syncProtocolVersion), ...headers },
    body: body instanceof Uint8Array ? body : JSON.stringify(body),
  });
  return response;
};
const document = (operation: "read" | "updates") =>
  ({
    kind: "document",
    projectId,
    spaceOwner: null,
    documentId: "built-network-document",
    operation,
  }) as const;
const blob = (operation: "begin" | "finish" | "read") =>
  ({
    kind: "blob",
    projectId,
    spaceOwner: null,
    blobId: "built-network-blob",
    operation,
  }) as const;
const changes = new URL(syncPath({ kind: "live", projectId }), process.env.RELAY_URL);
changes.protocol = "ws:";
const ws = new WebSocket(changes, {
  headers: {
    authorization: `Bearer ${token}`,
    [syncProtocolHeader]: String(syncProtocolVersion),
    [liveProtocolHeader]: String(liveProtocolVersion),
  },
});
const failure = Promise.withResolvers<never>();
const ready = Promise.withResolvers<void>();
const changed = Promise.withResolvers<void>();
const subscribed = Promise.withResolvers<void>();
const closed = Promise.withResolvers<CloseEvent>();
ws.addEventListener("error", () => failure.reject(new Error("Built socket failed")));
ws.addEventListener("message", (event) => {
  try {
    const message = liveServerMessageSchema.parse(JSON.parse(String(event.data)));
    if (message.type === "control-result" && message.requestId === "subscribe-network") {
      assert.equal(message.retryAfterMs, 0);
      subscribed.resolve();
    }
    if (message.type === "ready") ready.resolve();
    if (message.type === "changed") changed.resolve();
  } catch (error) {
    failure.reject(error);
  }
});
ws.addEventListener("close", (event) => closed.resolve(event));
const check = async () => {
  await ready.promise;
  ws.send(
    JSON.stringify({
      type: "subscribe",
      spaceOwner: null,
      topic: "built-network-document",
      requestId: "subscribe-network",
    }),
  );
  await subscribed.promise;
  const bytes = new TextEncoder().encode("built network encrypted bytes");
  const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const begun = await request(blob("begin"), { sha256, byteLength: bytes.length });
  assert.equal(begun.status, 200);
  assert.equal(blobStatusSchema.parse(await begun.json()).completed, false);
  const part = await request(
    { kind: "part", projectId, spaceOwner: null, blobId: "built-network-blob", number: 1 },
    bytes,
    "PUT",
    { "pstdio-sha256": sha256, "content-length": String(bytes.length) },
  );
  assert.equal(part.status, 200);
  assert.deepEqual(await part.json(), {});
  assert.equal((await request(blob("finish"), {})).status, 200);
  const update = {
    updateId: "built-network-update",
    payload: Buffer.from(bytes).toString("base64"),
    blobIds: ["built-network-blob"],
  };
  assert.deepEqual(updateResultSchema.parse(await (await request(document("updates"), update)).json()), {
    sequence: 1,
    duplicate: false,
  });
  assert.deepEqual(updateResultSchema.parse(await (await request(document("updates"), update)).json()), {
    sequence: 1,
    duplicate: true,
  });
  await changed.promise;
  const read = readResultSchema.parse(await (await request(document("read"), { after: 0 })).json());
  assert.equal(read.status, "updates");
  if (read.status === "updates") assert.equal(read.updates[0]!.payload, update.payload);
  const suffix = await request(blob("read"), { offset: 7 });
  assert.equal(suffix.status, 200);
  assert.equal(suffix.headers.get("pstdio-offset"), "7");
  assert.equal(suffix.headers.get("pstdio-byte-length"), String(bytes.length - 7));
  assert.deepEqual(new Uint8Array(await suffix.arrayBuffer()), bytes.subarray(7));
  console.log("READY_FOR_REVOCATION");
  assert.equal((await closed.promise).code, 1008);
  assert.equal((await request(document("read"), { after: 0 })).status, 401);
  console.log("Built credential-only blind HTTP, blob ranges, duplicate updates and expiring idle WebSocket passed");
};
try {
  await Promise.race([check(), failure.promise]);
} finally {
  controller.abort();
  ws.close();
}
