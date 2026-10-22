import { afterAll, beforeAll, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { connectDevice, createAuthorityFixture, provisionAccount } from "./authority.fixture";
import { connectManager } from "./database";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";
import { devices } from "./schema";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("authenticated heartbeats report device presence across managers and expire without erasing last seen", async () => {
  const owner = fixture.owner();
  const first = createAuthenticationFixture(fixture.databaseUrl);
  const second = createAuthenticationFixture(fixture.databaseUrl);
  const connection = connectManager(fixture.databaseUrl);
  const handler = implementation.createManagerHandler(first.auth, first.config.origin);
  const other = implementation.createManagerHandler(second.auth, second.config.origin);
  const call = (host: typeof handler, origin: string, token: string, path: string, method = "GET") =>
    host(
      new Request(`${origin}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        ...(method === "POST" ? { body: "{}" } : {}),
      }),
    );
  try {
    const accountId = await provisionAccount(owner);
    const laptop = await connectDevice(owner, accountId);
    const desktop = await connectDevice(owner, accountId);
    const stranger = await connectDevice(owner, await provisionAccount(owner));
    const scope = and(eq(devices.accountId, accountId), eq(devices.id, laptop.deviceId));
    const old = new Date(Date.now() - 60_000);
    await connection.db.update(devices).set({ lastSeenAt: old }).where(scope);
    const listed = async () => {
      const response = await call(other, second.config.origin, desktop.token, "/v1/devices");
      const body = (await response.json()) as { devices: { id: string; online: boolean; lastSeenAt: string }[] };
      return body.devices.find((entry) => entry.id === laptop.deviceId)!;
    };
    expect(await listed()).toMatchObject({ online: false, lastSeenAt: old.toISOString() });
    expect((await call(handler, first.config.origin, laptop.token, "/v1/devices/presence", "POST")).status).toBe(200);
    expect((await listed()).online).toBe(true);
    expect(Date.parse((await listed()).lastSeenAt)).toBeGreaterThan(old.getTime());
    const foreign = await call(other, second.config.origin, stranger.token, "/v1/devices");
    expect(await foreign.text()).not.toContain(laptop.deviceId);
    await connection.db.update(devices).set({ lastSeenAt: old }).where(scope);
    expect(await listed()).toMatchObject({ online: false, lastSeenAt: old.toISOString() });
    await call(handler, first.config.origin, desktop.token, `/v1/devices/${laptop.deviceId}/remove`, "POST");
    expect((await call(handler, first.config.origin, laptop.token, "/v1/devices/presence", "POST")).status).toBe(401);
  } finally {
    await Promise.all([owner.close(), first.close(), second.close(), connection.close()]);
  }
});
