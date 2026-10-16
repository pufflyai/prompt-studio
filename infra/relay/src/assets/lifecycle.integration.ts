import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { createRelayAssets } from "./assets";
import { createAssetFixture, newScope, reference } from "./integration-fixture";

const fixture = createAssetFixture();
let releases: (() => void)[] = [];
let pending: Promise<unknown>[] = [];
let shutdown: (() => Promise<unknown>)[] = [];
beforeAll(() => fixture.initialize());
afterEach(async () => {
  for (const release of releases) release();
  await Promise.allSettled(pending);
  for (const close of shutdown) await close();
  releases = [];
  pending = [];
  shutdown = [];
});
afterAll(() => fixture.close());

const owned = (service = fixture.owner()) => {
  let closing: Promise<void> | undefined;
  const close = () => (closing ??= service.close());
  shutdown.push(close);
  return { service, close };
};
const paused = (bytes: Uint8Array) => {
  const ready = Promise.withResolvers<void>();
  const controller = new AbortController();
  let sent = false;
  let cancelled = false;
  releases.push(() => controller.abort());
  return {
    ready: ready.promise,
    cancelled: () => cancelled,
    input: {
      ...reference(bytes),
      signal: controller.signal,
      body: new ReadableStream<Uint8Array>(
        {
          pull(stream) {
            if (sent) return new Promise(() => {});
            sent = true;
            stream.enqueue(bytes.subarray(0, 1));
            ready.resolve();
          },
          cancel() {
            cancelled = true;
          },
        },
        { highWaterMark: 0 },
      ),
    },
  };
};
const watch = (operation: Promise<unknown>) => {
  const result = operation.catch((error: unknown) => error);
  pending.push(result);
  return result;
};
const waitForWaiters = async (count: number) => {
  const sql = new SQL(fixture.config.databaseUrl);
  try {
    while (true) {
      const rows = await sql`SELECT count(*)::integer AS count FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event = 'advisory'
        AND query LIKE '%hashtextextended%'`;
      if (rows[0].count >= count) return;
      await Bun.sleep(10);
    }
  } finally {
    await sql.close();
  }
};

test("a failed part request cancels a stalled producer and releases its upload lock", async () => {
  const bytes = new TextEncoder().encode("failed part request");
  const scope = newScope();
  const proxy = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === "PUT" && url.searchParams.has("partNumber")) {
        return new Response("<Error><Code>AccessDenied</Code><Message>Denied part</Message></Error>", { status: 403 });
      }
      return fetch(`${fixture.config.s3.endpoint}${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    },
  });
  const owner = owned(createRelayAssets({ ...fixture.config, s3: { ...fixture.config.s3, endpoint: proxy.url.href } }));
  shutdown.push(() => proxy.stop(true));
  await owner.service.begin(scope, "failed", reference(bytes));
  const source = paused(bytes);
  const writing = watch(owner.service.writePart(scope, "failed", 1, source.input));
  await source.ready;
  expect(await writing).toBeInstanceOf(Error);
  expect(source.cancelled()).toBe(true);
  await owner.service.cancel(scope, "failed");
  expect(await owner.service.complete(scope, reference(bytes))).toBe(false);
});

test("an independent owner cancels a paused writer before cleanup completes", async () => {
  const writer = owned();
  const canceller = owned();
  const scope = newScope();
  const bytes = new TextEncoder().encode("cross-owner cancellation");
  await writer.service.begin(scope, "remote-cancel", reference(bytes));
  const source = paused(bytes);
  const writing = watch(writer.service.writePart(scope, "remote-cancel", 1, source.input));
  await source.ready;
  await canceller.service.cancel(scope, "remote-cancel");
  expect(await writing).toBeInstanceOf(Error);
  expect(source.cancelled()).toBe(true);
  await expect(writer.service.begin(scope, "remote-cancel", reference(bytes))).rejects.toThrow("cancelled");
});

test("same-key retries cannot starve durable cancellation behind the upload pool", async () => {
  const writer = owned();
  const scope = newScope();
  const bytes = new TextEncoder().encode("queued retries");
  await writer.service.begin(scope, "same-key", reference(bytes));
  const sources = Array.from({ length: 11 }, () => paused(bytes));
  const writing = sources.map((source) => watch(writer.service.writePart(scope, "same-key", 1, source.input)));
  await Promise.race(sources.map((source) => source.ready));
  await waitForWaiters(9);
  console.log("One paused writer, nine advisory waiters and another queued retry reached cancellation");
  await writer.service.cancel(scope, "same-key");
  for (const result of await Promise.all(writing)) expect(result).toBeInstanceOf(Error);
  expect(await writer.service.complete(scope, reference(bytes))).toBe(false);
});

test("closing an owner stops queued retries from starting another paused transfer", async () => {
  const owner = owned();
  const scope = newScope();
  const bytes = new TextEncoder().encode("queued close");
  await owner.service.begin(scope, "close", reference(bytes));
  const first = paused(bytes);
  const second = paused(bytes);
  const writing = watch(owner.service.writePart(scope, "close", 1, first.input));
  await first.ready;
  const queued = watch(owner.service.writePart(scope, "close", 1, second.input));
  await waitForWaiters(1);
  await owner.close();
  expect(await writing).toBeInstanceOf(Error);
  expect(await queued).toBeInstanceOf(Error);
  expect(first.cancelled()).toBe(true);
  expect(second.cancelled()).toBe(true);
  await expect(owner.service.begin(scope, "after-close", reference(bytes))).rejects.toThrow("closed");
});

test("losing cancellation notifications interrupts work and rejects later admission", async () => {
  const owner = owned();
  const scope = newScope();
  const bytes = new TextEncoder().encode("lost cancellation connection");
  await owner.service.begin(scope, "listener-loss", reference(bytes));
  const source = paused(bytes);
  const writing = watch(owner.service.writePart(scope, "listener-loss", 1, source.input));
  await source.ready;
  const sql = new SQL(fixture.config.databaseUrl);
  try {
    const listeners = await sql`SELECT pid FROM pg_stat_activity
      WHERE datname = current_database() AND query = 'LISTEN relay_asset_cancel'`;
    expect(listeners).toHaveLength(1);
    const result = await sql`SELECT pg_terminate_backend(${listeners[0].pid}) AS terminated`;
    expect(result[0].terminated).toBe(true);
  } finally {
    await sql.close();
  }
  expect(await writing).toBeInstanceOf(Error);
  expect(source.cancelled()).toBe(true);
  await expect(owner.service.begin(scope, "after-loss", reference(bytes))).rejects.toThrow();
});

for (const stage of ["list uploads", "abort multipart", "check aborted parts", "delete object"]) {
  test(`closing an owner interrupts cancellation during ${stage}`, async () => {
    const ready = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    releases.push(release.resolve);
    let cancelling = false;
    const proxy = fixture.proxy(async (request, response) => {
      const url = new URL(request.url);
      const multipart = url.searchParams.has("uploadId");
      const matches =
        (stage === "list uploads" && request.method === "GET" && url.searchParams.has("uploads")) ||
        (stage === "abort multipart" && request.method === "DELETE" && multipart) ||
        (stage === "check aborted parts" && request.method === "GET" && multipart) ||
        (stage === "delete object" && request.method === "DELETE" && !multipart);
      if (cancelling && matches) {
        ready.resolve();
        await release.promise;
      }
      return response;
    });
    const owner = owned(proxy.owner);
    shutdown.push(proxy.close);
    const scope = newScope();
    const asset = reference(new TextEncoder().encode("interrupted cancellation"));
    await owner.service.begin(scope, "cleanup", asset);
    cancelling = true;
    const cancellation = watch(owner.service.cancel(scope, "cleanup"));
    await ready.promise;
    await owner.close();
    expect(await cancellation).toBeInstanceOf(Error);
    release.resolve();
    const recovery = owned();
    await recovery.service.cancel(scope, "cleanup");
    expect(await recovery.service.complete(scope, asset)).toBe(false);
    await expect(recovery.service.begin(scope, "cleanup", asset)).rejects.toThrow("cancelled");
  });
}
