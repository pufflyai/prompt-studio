import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  type RelayOperation,
  receiptSchema,
  relayAssetStatusSchema,
  relayPath,
  sealMutation,
} from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("HTTP multipart resume publishes only verified assets and streams immutable offsets", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const bytes = new Uint8Array(5 * 1024 * 1024 + 32).fill(7);
  const hash = (data: Uint8Array) => new Bun.CryptoHasher("sha256").update(data).digest("hex");
  const asset = { sha256: hash(bytes), byteLength: bytes.length, mediaType: "application/octet-stream" };
  const call = (operation: RelayOperation, body: unknown) =>
    fetch(new URL(relayPath(context.scope, operation), server.url), {
      method: "POST",
      headers: { authorization: `Bearer ${context.token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const begun = await call("assets/begin", { uploadId: "resumable", asset });
    expect(begun.status).toBe(200);
    const state = relayAssetStatusSchema.parse(await begun.json());
    expect(state.partSize).toBe(5 * 1024 * 1024);
    expect(state.parts).toEqual([]);
    expect(Object.keys(state).sort()).toEqual(["asset", "completed", "partSize", "parts"]);
    const mutation = await sealMutation({
      protocolVersion: 1,
      scope: context.scope,
      environmentId: context.environmentId,
      operationId: "asset-group",
      parents: [],
      changes: [{ recordId: "image", expectedRevision: 0, baseDeleted: false, asset: { base: null, next: asset } }],
    });
    expect(receiptSchema.parse(await (await call("submit", mutation)).json()).status).toBe("pending");
    for (const [index, part] of [bytes.subarray(0, state.partSize), bytes.subarray(state.partSize)].entries()) {
      const response = await fetch(new URL(relayPath(context.scope, "assets/part"), server.url), {
        method: "PUT",
        headers: {
          authorization: `Bearer ${context.token}`,
          "x-pstdio-upload-id": encodeURIComponent("resumable"),
          "x-pstdio-part-number": String(index + 1),
          "x-pstdio-sha256": hash(part),
          "content-length": String(part.length),
        },
        body: new Blob([part]).stream(),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({});
      const resumed = relayAssetStatusSchema.parse(
        await (await call("assets/begin", { uploadId: "resumable", asset })).json(),
      );
      expect(resumed.parts).toHaveLength(index + 1);
      expect(Object.keys(resumed.parts[index]!).sort()).toEqual(["byteLength", "number", "sha256"]);
    }
    expect(await (await call("assets/finish", { uploadId: "resumable" })).json()).toEqual(asset);
    expect(receiptSchema.parse(await (await call("submit", mutation)).json()).status).toBe("accepted");
    const offset = 12345;
    const read = await call("assets/read", { asset, offset });
    expect(read.status).toBe(200);
    expect(read.headers.get("x-pstdio-offset")).toBe(String(offset));
    expect(read.headers.get("x-pstdio-byte-length")).toBe(String(bytes.length - offset));
    expect(read.headers.get("content-type")).toBe(asset.mediaType);
    const assembled = new Bun.CryptoHasher("sha256").update(bytes.subarray(0, offset));
    let received = offset;
    for await (const chunk of read.body!) {
      received += chunk.byteLength;
      assembled.update(chunk);
    }
    expect(received).toBe(asset.byteLength);
    expect(assembled.digest("hex")).toBe(asset.sha256);
    expect((await call("assets/read", { asset, offset: bytes.length + 1 })).status).toBe(400);
    const otherScope = { ...context.scope, extensionId: "other" };
    await context.storage.initialize(otherScope, "published-other");
    const wrong = await fetch(new URL(relayPath(otherScope, "assets/read"), server.url), {
      method: "POST",
      headers: { authorization: `Bearer ${context.token}` },
      body: JSON.stringify({ asset, offset: 0 }),
    });
    expect(wrong.status).toBe(404);
  } finally {
    await server.stop(true);
    await context.close();
  }
});
