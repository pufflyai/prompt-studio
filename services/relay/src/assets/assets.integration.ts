import { afterAll, beforeAll, expect, test } from "bun:test";
import { ListMultipartUploadsCommand } from "@aws-sdk/client-s3";
import { fingerprint } from "pstdio-sync-contracts";
import { createRelayAssets } from "./assets";
import { createAssetFixture, input, newScope, reference } from "./integration-fixture";

const fixture = createAssetFixture();
const config = fixture.config;
let assets: ReturnType<typeof createRelayAssets>;

beforeAll(async () => {
  await fixture.initialize();
  assets = fixture.owner();
});
afterAll(async () => {
  await assets?.close();
  fixture.close();
});

test("verified streaming bytes survive reopening and stay scoped", async () => {
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "images" };
  const bytes = new TextEncoder().encode("durable image");
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "image/png",
  };
  const uploadId = "same-upload";
  expect(await assets.complete(scope, asset)).toBe(false);
  await assets.begin(scope, uploadId, asset);
  await assets.writePart(scope, uploadId, 1, {
    sha256: asset.sha256,
    byteLength: bytes.length,
    body: new Blob([bytes]).stream(),
  });
  expect(await assets.complete(scope, asset)).toBe(false);
  await assets.finish(scope, uploadId);
  await assets.close();
  assets = createRelayAssets(config);
  expect(await assets.complete(scope, asset)).toBe(true);
  expect(await assets.finish(scope, uploadId)).toEqual(asset);
  const stored = await assets.read(scope, asset);
  expect(stored?.asset).toEqual(asset);
  expect(new Uint8Array(await new Response(stored!.body).arrayBuffer())).toEqual(bytes);
  const other = { ...scope, accountId: "other" };
  expect(await assets.complete(other, asset)).toBe(false);
  expect(await assets.read(other, asset)).toBeNull();
});

test("acknowledged multipart progress resumes through an independent owner", async () => {
  const scope = newScope();
  const bytes = new Uint8Array(5 * 1024 * 1024 + 128).fill(7);
  const asset = reference(bytes);
  const opened = await assets.begin(scope, "resume", asset);
  const first = bytes.subarray(0, opened.partSize);
  await assets.writePart(scope, "resume", 1, input(first));
  await assets.close();
  assets = createRelayAssets(config);
  const resumed = await assets.begin(scope, "resume", asset);
  expect(resumed.parts.map((part) => part.number)).toEqual([1]);
  expect(resumed.parts[0].etag).toBeTruthy();
  await assets.writePart(scope, "resume", 1, input(first));
  await assets.writePart(scope, "resume", 2, input(bytes.subarray(opened.partSize)));
  expect(await assets.finish(scope, "resume")).toEqual(asset);
  const stored = await assets.read(scope, asset);
  const hash = new Bun.CryptoHasher("sha256");
  let length = 0;
  for await (const chunk of stored!.body) {
    hash.update(chunk);
    length += chunk.byteLength;
  }
  expect(hash.digest("hex")).toBe(asset.sha256);
  expect(length).toBe(asset.byteLength);
});

test("concurrent owners keep upload and part identities immutable", async () => {
  const scope = newScope();
  const bytes = new TextEncoder().encode("one intent");
  const asset = reference(bytes);
  const other = createRelayAssets(config);
  try {
    await Promise.all([assets.begin(scope, "same", asset), other.begin(scope, "same", asset)]);
    await expect(other.begin(scope, "same", { ...asset, mediaType: "text/plain" })).rejects.toThrow("identity");
    await Promise.all([
      assets.writePart(scope, "same", 1, input(bytes)),
      other.writePart(scope, "same", 1, input(bytes)),
    ]);
    await expect(other.writePart(scope, "same", 1, input(new Uint8Array(bytes.length).fill(1)))).rejects.toThrow(
      "identity",
    );
    const results = await Promise.all([assets.finish(scope, "same"), other.finish(scope, "same")]);
    expect(results).toEqual([asset, asset]);
    await other.cancel(scope, "same");
    expect(await assets.complete(scope, asset)).toBe(true);
    for (const redirected of [
      { ...scope, accountId: "other" },
      { ...scope, workbenchId: "other" },
      { ...scope, extensionId: "other" },
    ]) {
      expect(await other.complete(redirected, asset)).toBe(false);
      await other.cancel(redirected, "same");
    }
    expect(await assets.complete(scope, asset)).toBe(true);
  } finally {
    await other.close();
  }
});

test("cancellation removes a multipart upload whose create acknowledgment was lost", async () => {
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "images" };
  const bytes = new TextEncoder().encode("lost create response");
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "image/png",
  };
  let lost = false;
  const proxy = fixture.proxy(async (request, upstream) => {
    const url = new URL(request.url);
    if (request.method === "POST" && url.searchParams.has("uploads") && !lost) {
      lost = true;
      await upstream.arrayBuffer();
      return new Response("Lost upload acknowledgment", { status: 502 });
    }
    return upstream;
  });
  const owner = proxy.owner;
  const client = fixture.client;
  const bucket = config.bucket;
  const prefix = `assets/${await fingerprint(scope)}/${await fingerprint("interrupted")}`;
  try {
    await expect(owner.begin(scope, "interrupted", asset)).rejects.toThrow();
    expect(lost).toBe(true);
    expect(
      (await client.send(new ListMultipartUploadsCommand({ Bucket: bucket, Prefix: prefix }))).Uploads,
    ).toHaveLength(1);
    await owner.cancel(scope, "interrupted");
    expect(
      (await client.send(new ListMultipartUploadsCommand({ Bucket: bucket, Prefix: prefix }))).Uploads ?? [],
    ).toHaveLength(0);
    expect(await owner.complete(scope, asset)).toBe(false);
  } finally {
    await owner.close();
    await proxy.close();
  }
});
