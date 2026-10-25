import { afterAll, beforeAll, expect, test } from "bun:test";
import { fingerprint, relayPath } from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { withFixtureDatabase } from "./database.fixture";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("a disconnected HTTP reader cancels its owned backend and later requests still work", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const controller = new AbortController();
  let release = await fixture.blockRelayData();
  let guard: ReturnType<typeof setTimeout> | undefined;
  let unlockedByGuard = false;
  const url = new URL(relayPath(context.scope, "snapshot"), server.url);
  const headers = { authorization: `Bearer ${context.token}` };
  const reading = fetch(url, { headers, signal: controller.signal }).catch((error: unknown) => error);
  try {
    await fixture.waitForBlockedData();
    guard = setTimeout(() => {
      unlockedByGuard = true;
      const unlock = release;
      release = async () => {};
      void unlock();
    }, 1000);
    controller.abort();
    expect(await reading).toBeInstanceOf(Error);
    await withFixtureDatabase(fixture.relayDatabaseUrl, async (client) => {
      while (
        (
          await client.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
          )
        ).rows.length
      )
        await new Promise<void>((resolve) => setImmediate(resolve));
    });
    expect(unlockedByGuard).toBe(false);
    clearTimeout(guard);
    await release();
    release = async () => {};
    expect((await fetch(url, { headers })).status).toBe(200);
  } finally {
    clearTimeout(guard);
    controller.abort();
    await reading;
    await release();
    await server.stop(true);
    await context.close();
  }
});

test("SIGTERM drains an HTTP query blocked by an external content lock before that lock is released", async () => {
  const context = await fixture.context();
  const child = Bun.spawn([process.execPath, new URL("../server.ts", import.meta.url).pathname], {
    env: { PATH: process.env.PATH!, ...context.serverEnv, RELAY_HOST: "127.0.0.1", RELAY_PORT: "0" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = child.stdout.getReader();
  const errors = new Response(child.stderr).text();
  let release = async () => {};
  let releasedByCleanupGuard = false;
  let guard: ReturnType<typeof setTimeout> | undefined;
  let reading: Promise<unknown> | undefined;
  try {
    const first = new TextDecoder().decode((await output.read()).value);
    const origin = /Relay listening at (http:\/\/[^\s]+)/.exec(first)?.[1];
    expect(origin).toBeDefined();
    release = await fixture.blockRelayData();
    reading = Promise.all(
      Array.from({ length: 12 }, () =>
        fetch(new URL(relayPath(context.scope, "snapshot"), origin), {
          headers: { authorization: `Bearer ${context.token}` },
        }).catch((error: unknown) => error),
      ),
    );
    await fixture.waitForBlockedData(10);
    // This guard only cleans up a broken implementation inside the existing five-second test limit.
    guard = setTimeout(() => {
      releasedByCleanupGuard = true;
      const unlock = release;
      release = async () => {};
      void unlock();
    }, 1000);
    child.kill("SIGTERM");
    expect(await child.exited).toBe(0);
    expect(await errors).toBe("");
    expect(releasedByCleanupGuard).toBe(false);
    await withFixtureDatabase(fixture.relayDatabaseUrl, async (client) => {
      const result = await client.query(
        "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
      );
      console.log(
        JSON.stringify({ phase: "service stopped before external unlock", blockedBackends: result.rows[0].count }),
      );
      expect(result.rows[0].count).toBe(0);
    });
  } finally {
    clearTimeout(guard);
    await release();
    child.kill();
    await child.exited;
    await reading;
    output.releaseLock();
    await context.close();
  }
});

test("HTTP cancellation drains a streamed upload while unrelated content reads are locked", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const bytes = new Uint8Array(2 * 1024 * 1024).fill(8);
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "application/octet-stream",
  };
  const controller = new AbortController();
  let release = async () => {};
  let guard: ReturnType<typeof setTimeout> | undefined;
  let unlockedByCleanupGuard = false;
  const sourceReleased = Promise.withResolvers<void>();
  let writing: Promise<unknown> | undefined;
  const headers = { authorization: `Bearer ${context.token}` };
  try {
    await context.assets.begin(context.scope, "cancel-under-lock", asset);
    let sent = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(stream) {
          if (sent) return new Promise(() => {});
          sent = true;
          stream.enqueue(bytes.subarray(0, 64 * 1024));
        },
        cancel() {
          sourceReleased.resolve();
        },
      },
      { highWaterMark: 0 },
    );
    writing = fetch(new URL(relayPath(context.scope, "assets/part"), server.url), {
      method: "PUT",
      headers: {
        ...headers,
        "x-pstdio-upload-id": "cancel-under-lock",
        "x-pstdio-part-number": "1",
        "x-pstdio-sha256": asset.sha256,
        "content-length": String(bytes.length),
      },
      body,
      signal: controller.signal,
    }).catch((error: unknown) => error);
    await withFixtureDatabase(fixture.relayDatabaseUrl, async (client) => {
      while (
        !(
          await client.query('SELECT 1 FROM relay_asset_parts WHERE "ownerId"=$1 AND "uploadId"=$2', [
            await fingerprint(context.scope),
            "cancel-under-lock",
          ])
        ).rows.length
      )
        await new Promise<void>((resolve) => setImmediate(resolve));
    });
    release = await fixture.blockRelayData();
    guard = setTimeout(() => {
      unlockedByCleanupGuard = true;
      const unlock = release;
      release = async () => {};
      void unlock();
    }, 1000);
    const response = await fetch(new URL(relayPath(context.scope, "assets/cancel"), server.url), {
      method: "POST",
      headers,
      body: JSON.stringify({ uploadId: "cancel-under-lock" }),
    });
    expect(response.status).toBe(200);
    await sourceReleased.promise;
    const result = await writing;
    expect(result instanceof Error || (result instanceof Response && result.status === 409)).toBe(true);
    expect(unlockedByCleanupGuard).toBe(false);
  } finally {
    clearTimeout(guard);
    await release();
    controller.abort();
    await writing;
    await server.stop(true);
    await context.close();
  }
});
