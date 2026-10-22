import { afterAll, beforeAll, expect, test } from "bun:test";
import { createLocalJWKSet, jwtVerify } from "jose";
import { connectDevice, createAuthorityFixture, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("a device renews scoped access that stays valid until expiry after the device is removed", async () => {
  const manager = fixture.owner();
  const auth = implementation.createManagerAuthentication(authenticationConfig(fixture.databaseUrl));
  try {
    const accountId = await provisionAccount(manager);
    const device = await connectDevice(manager, accountId);
    const [before] = await manager.devices(accountId);
    const access = await auth.renew(device.token, device.workbenchId);
    const keys = createLocalJWKSet(await auth.jwks());
    const verification = { issuer: "https://auth.fixture.test", audience: "https://relay.fixture.test" };
    const { payload } = await jwtVerify(access.token, keys, verification);
    expect(payload).toMatchObject({
      tokenType: "pstdio-environment-access",
      accountId,
      workbenchId: device.workbenchId,
      environmentId: device.deviceId,
      sub: device.deviceId,
    });
    expect(payload.exp! - payload.iat!).toBe(30);
    expect(access.expiresAt).toBe(new Date(payload.exp! * 1000).toISOString());
    const [after] = await manager.devices(accountId);
    expect(Date.parse(after.lastSeenAt)).toBeGreaterThan(Date.parse(before.lastSeenAt));
    await manager.removeDevice({ accountId, deviceId: device.deviceId });
    const denied = await auth.renew(device.token, device.workbenchId).catch((error: unknown) => error);
    expect(denied).toBeInstanceOf(Error);
    expect((await jwtVerify(access.token, keys, verification)).payload).toEqual(payload);
  } finally {
    await Promise.all([auth.close(), manager.close()]);
  }
});

test("renewed access expires after the access lifetime", async () => {
  const manager = fixture.owner();
  const auth = implementation.createManagerAuthentication({
    ...authenticationConfig(fixture.databaseUrl),
    accessLifetimeSeconds: 2,
  });
  try {
    const accountId = await provisionAccount(manager);
    const device = await connectDevice(manager, accountId);
    const issued = await auth.renew(device.token, device.workbenchId);
    const verify = implementation.createEnvironmentAccessVerifier({
      issuer: "https://auth.fixture.test",
      audience: "https://relay.fixture.test",
      jwks: await auth.jwks(),
    });
    expect(await verify(issued.token)).toMatchObject({ accountId });
    await Bun.sleep(2100);
    await expect(verify(issued.token)).rejects.toThrow();
  } finally {
    await Promise.all([auth.close(), manager.close()]);
  }
});
