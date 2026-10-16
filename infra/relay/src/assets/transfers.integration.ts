import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { ListMultipartUploadsCommand } from "@aws-sdk/client-s3";
import { fingerprint } from "pstdio-sync-contracts";
import { createRelayAssets } from "./assets";
import { createAssetFixture, input, newScope, reference } from "./integration-fixture";

const fixture = createAssetFixture();
let assets = fixture.owner();
let cleanup: (() => void)[] = [];
beforeAll(() => fixture.initialize());
afterEach(() => {
  for (const release of cleanup) release();
  cleanup = [];
});
afterAll(async () => {
  await assets.close();
  fixture.close();
});

const stalledInput = (bytes: Uint8Array) => {
  const started = Promise.withResolvers<void>();
  const controller = new AbortController();
  let sent = false;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(stream) {
        if (sent) return new Promise(() => {});
        sent = true;
        stream.enqueue(bytes.subarray(0, 1));
        started.resolve();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  cleanup.push(() => controller.abort());
  return {
    input: { ...reference(bytes), body, signal: controller.signal },
    started: started.promise,
    abort: () => controller.abort(),
    cancelled: () => cancelled,
  };
};

test("disconnection preserves multipart intent while explicit cancellation removes unfinished bytes", async () => {
  const scope = newScope();
  const bytes = new TextEncoder().encode("interrupted stream");
  const asset = reference(bytes);
  await assets.begin(scope, "disconnect", asset);
  const first = stalledInput(bytes);
  const transfer = assets.writePart(scope, "disconnect", 1, first.input).catch((error: unknown) => error);
  await first.started;
  first.abort();
  expect(await transfer).toBeInstanceOf(Error);
  expect(first.cancelled()).toBe(true);
  await assets.close();
  assets = fixture.owner();
  const resumed = await assets.begin(scope, "disconnect", asset);
  expect(resumed.parts[0].etag).toBeNull();
  await assets.writePart(scope, "disconnect", 1, input(bytes));
  await assets.finish(scope, "disconnect");
  expect(await assets.complete(scope, asset)).toBe(true);

  await assets.begin(scope, "cancel", asset);
  const second = stalledInput(bytes);
  const cancelled = assets.writePart(scope, "cancel", 1, second.input).catch((error: unknown) => error);
  await second.started;
  await assets.cancel(scope, "cancel");
  expect(await cancelled).toBeInstanceOf(Error);
  expect(second.cancelled()).toBe(true);
  const key = `assets/${await fingerprint(scope)}/${await fingerprint("cancel")}`;
  const uploads = await fixture.client.send(
    new ListMultipartUploadsCommand({ Bucket: fixture.config.bucket, Prefix: key }),
  );
  expect(uploads.Uploads ?? []).toHaveLength(0);
  await expect(assets.begin(scope, "cancel", asset)).rejects.toThrow("cancelled");
  expect(await assets.complete(scope, asset)).toBe(true);
});

test("cancellation can drain an active upload while concurrent streams fill the connection pool", async () => {
  const started = performance.now();
  const phase = (name: string) =>
    console.log(`Concurrent upload ${name}: ${(performance.now() - started).toFixed(2)}ms`);
  const scope = newScope();
  const bytes = new TextEncoder().encode("paused upload");
  const asset = reference(bytes);
  const ids = Array.from({ length: 10 }, (_, index) => `busy-${index}`);
  const streams = ids.map(() => stalledInput(bytes));
  await Promise.all(ids.map((id) => assets.begin(scope, id, asset)));
  phase("intents created");
  const transfers = ids.map((id, index) =>
    assets.writePart(scope, id, 1, streams[index].input).catch((error: unknown) => error),
  );
  try {
    await Promise.all(streams.map((stream) => stream.started));
    phase("all streams paused inside real requests");
    await assets.cancel(scope, ids[0]);
    phase("target cancellation drained");
    expect(await transfers[0]).toBeInstanceOf(Error);
    expect(streams[0].cancelled()).toBe(true);
    expect(await assets.complete(scope, asset)).toBe(false);
  } finally {
    for (const stream of streams) stream.abort();
    await Promise.allSettled(transfers);
    await Promise.all(ids.map((id) => assets.cancel(scope, id)));
    phase("remaining streams cleaned");
  }
});

test("upload requests stream before the producer releases the remaining bytes", async () => {
  const scope = newScope();
  const chunk = new Uint8Array(64 * 1024).fill(4);
  const count = 80;
  const hash = new Bun.CryptoHasher("sha256");
  for (let index = 0; index < count; index++) hash.update(chunk);
  const asset = { sha256: hash.digest("hex"), byteLength: count * chunk.byteLength, mediaType: "image/png" };
  const release = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  cleanup.push(() => release.resolve());
  let produced = 0;
  const proxy = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === "PUT" && url.searchParams.has("partNumber")) arrived.resolve();
      return fetch(`${fixture.config.s3.endpoint}${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    },
  });
  const owner = createRelayAssets({ ...fixture.config, s3: { ...fixture.config.s3, endpoint: proxy.url.href } });
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        if (produced > 0) await release.promise;
        produced++;
        controller.enqueue(chunk);
        if (produced === count) controller.close();
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark: chunk.byteLength }),
  );
  let writing: Promise<void> | undefined;
  try {
    await owner.begin(scope, "incremental", asset);
    writing = owner.writePart(scope, "incremental", 1, { ...asset, body });
    void writing.catch(() => {});
    await arrived.promise;
    expect(produced).toBeLessThan(count);
    console.log(
      JSON.stringify({
        phase: "upload request reached real storage",
        producedBytes: produced * chunk.byteLength,
        totalBytes: asset.byteLength,
        ...process.memoryUsage(),
      }),
    );
    release.resolve();
    await writing;
    expect(await owner.finish(scope, "incremental")).toEqual(asset);
    expect(await owner.complete(scope, asset)).toBe(true);
  } finally {
    release.resolve();
    await writing?.catch(() => {});
    await owner.close();
    await proxy.stop(true);
  }
});

test("cancellation interrupts verification while the durable download is paused", async () => {
  const started = performance.now();
  const phase = (name: string) =>
    console.log(`Verification cancellation ${name}: ${(performance.now() - started).toFixed(2)}ms`);
  const scope = newScope();
  const bytes = new TextEncoder().encode("paused durable verification");
  const asset = reference(bytes);
  const reading = Promise.withResolvers<void>();
  const proxy = fixture.proxy(async (request, response) => {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.searchParams.has("uploadId") || url.searchParams.has("uploads"))
      return response;
    let closed = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        cleanup.push(() => {
          if (!closed) controller.close();
          closed = true;
        });
        controller.enqueue(bytes.subarray(0, 1));
        reading.resolve();
      },
      cancel() {
        closed = true;
      },
    });
    await response.body?.cancel();
    return new Response(body, { status: response.status, headers: response.headers });
  });
  let finishing: Promise<unknown> | undefined;
  try {
    await proxy.owner.begin(scope, "paused-verify", asset);
    phase("intent created");
    await proxy.owner.writePart(scope, "paused-verify", 1, input(bytes));
    phase("part committed");
    finishing = proxy.owner.finish(scope, "paused-verify").catch((error: unknown) => error);
    await reading.promise;
    phase("download paused");
    await proxy.owner.cancel(scope, "paused-verify");
    phase("cancelled and cleaned");
    expect(await finishing).toBeInstanceOf(Error);
    expect(await proxy.owner.complete(scope, asset)).toBe(false);
  } finally {
    for (const release of cleanup) release();
    cleanup = [];
    await finishing;
    await proxy.owner.close();
    await proxy.close();
  }
});
