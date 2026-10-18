import { afterAll, beforeAll, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRelayAccess, createRelayAdapter, createRelayConnection } from "pstdio-sync/relay";
import { startRelay } from "../service";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("native renewal and sockets renew at finite expiry without overlapping synchronization", async () => {
  const context = await fixture.context({ accessLifetimeSeconds: 2 });
  const manager = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: context.managerHandler });
  const relay = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const controller = new AbortController();
  const access = createRelayAccess({
    managerOrigin: manager.url.origin,
    workbenchId: context.scope.workbenchId,
    renewalGrant: context.grant.token!,
    signal: controller.signal,
  });
  const adapter = createRelayAdapter({
    origin: relay.url.origin,
    scope: context.scope,
    token: async () => (await access()).token,
    signal: controller.signal,
  });
  const renewed = Promise.withResolvers<void>();
  let first: string | undefined;
  let active = 0;
  let maximum = 0;
  const connection = createRelayConnection({
    origin: relay.url.origin,
    scope: context.scope,
    signal: controller.signal,
    access,
    synchronize: async () => {
      active++;
      maximum = Math.max(active, maximum);
      try {
        const current = await access();
        await adapter.snapshot();
        if (first && first !== current.token) renewed.resolve();
        first ??= current.token;
      } finally {
        active--;
      }
    },
  });
  try {
    for (let index = 0; index < 100; index++) connection.wake();
    await renewed.promise;
    expect(maximum).toBe(1);
    await context.manager.revoke({
      requestId: "end-renewal",
      accountId: context.scope.accountId,
      environmentId: context.environmentId,
    });
    const response = await fetch(new URL("/v1/environment-access", manager.url), {
      method: "POST",
      headers: { authorization: `Bearer ${context.grant.token}` },
      body: JSON.stringify({ workbenchId: context.scope.workbenchId }),
    });
    expect(response.status).toBe(401);
    expect((await adapter.snapshot()).scope).toEqual(context.scope);
  } finally {
    controller.abort();
    await connection.done;
    await Promise.all([relay.stop(true), manager.stop(true), context.close()]);
  }
});

test("native multipart staging resumes verified parts and returns immutable offset streams", async () => {
  const context = await fixture.context();
  const relay = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const controller = new AbortController();
  const adapter = createRelayAdapter({
    origin: relay.url.origin,
    scope: context.scope,
    token: async () => context.token,
    signal: controller.signal,
  });
  const bytes = new Uint8Array(12 * 1024 * 1024).fill(7);
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "application/octet-stream",
  };
  try {
    await adapter.assets!.put(asset, async () => new Blob([bytes]).stream());
    await adapter.assets!.put(asset, async () => {
      throw new Error("Completed asset must not reopen its source");
    });
    const body = await adapter.assets!.get(asset, 71);
    const hash = new Bun.CryptoHasher("sha256").update(bytes.subarray(0, 71));
    for await (const part of body!) hash.update(part);
    expect(hash.digest("hex")).toBe(asset.sha256);
  } finally {
    controller.abort();
    await relay.stop(true);
    await context.close();
  }
});

test("a rejected local asset source leaves no native upload spool", async () => {
  const context = await fixture.context();
  const relay = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const controller = new AbortController();
  const adapter = createRelayAdapter({
    origin: relay.url.origin,
    scope: context.scope,
    token: async () => context.token,
    signal: controller.signal,
  });
  const spools = async () => (await readdir(tmpdir())).filter((name) => name.startsWith("pstdio-relay-upload-")).sort();
  const before = await spools();
  try {
    const asset = { sha256: "0".repeat(64), byteLength: 1, mediaType: "application/octet-stream" };
    await expect(
      adapter.assets!.put(asset, async () => {
        throw new Error("Owned source unavailable");
      }),
    ).rejects.toThrow("Owned source unavailable");
    expect(await spools()).toEqual(before);
  } finally {
    controller.abort();
    await relay.stop(true);
    await context.close();
  }
});
