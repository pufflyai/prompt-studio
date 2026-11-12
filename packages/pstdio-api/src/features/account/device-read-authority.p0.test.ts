import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { Hono } from "hono";
import { createNativeAccount } from "../../services/account/native-account";
import { createNativeStore } from "../../services/account/native-store";
import { createAccountRoutes } from "./routes";

test("device reads fence both account and manager before admission and after a held response", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pstdio-device-authority-"));
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  let otherReads = 0;
  const devices = (name: string) => ({
    deviceId: "device",
    devices: [
      {
        id: "device",
        name,
        platform: "test",
        createdAt: "2026-11-11T00:00:00Z",
        lastSeenAt: "2026-11-11T00:00:00Z",
        online: true,
      },
    ],
  });
  const first = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      entered.resolve();
      await release.promise;
      return Response.json(devices("first-manager"));
    },
  });
  const second = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      otherReads++;
      return Response.json(devices("second-manager"));
    },
  });
  const file = join(dir, "account.json"),
    store = createNativeStore(file);
  const login = {
    accountId: "account",
    deviceId: "device",
    token: "fixture-colliding-token",
    relayOrigin: first.url.origin,
    managerOrigin: first.url.origin,
  };
  await store.save(login);
  const account = createNativeAccount({
    file,
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: { get: async () => null } as never,
  });
  const app = new Hono().route("/v1", createAccountRoutes(account));
  const runtime = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
  const client = createClient({ baseUrl: runtime.url.origin, token: "" });
  const expected = { accountId: "account", managerOrigin: first.url.origin };
  const reading = client.account.devices({ expected }).then(
    (value) => ({ ok: true, value }),
    () => ({ ok: false }),
  );
  try {
    await Promise.race([
      entered.promise,
      reading.then((result) => {
        throw new Error("Device read settled before manager admission: " + JSON.stringify(result));
      }),
    ]);
    // Account ids and credentials can collide across managers; the origin is part of authority.
    await store.save({ ...login, managerOrigin: second.url.origin });
    release.resolve();
    expect(await reading).toEqual({ ok: false });
    await expect(client.account.devices({ expected })).rejects.toThrow();
    expect(otherReads).toBe(0);
    expect(
      (await client.account.devices({ expected: { ...expected, managerOrigin: second.url.origin } }))[0]?.name,
    ).toBe("second-manager");
    expect(otherReads).toBe(1);
  } finally {
    release.resolve();
    await reading;
    await runtime.stop(true);
    await account.close();
    await first.stop(true);
    await second.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
});
