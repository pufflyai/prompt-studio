import { afterAll, beforeAll, expect, test } from "bun:test";
import { connectDevice, createAuthorityFixture, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("accounts without early access can manage devices but receive no Cloud projects, keys or relay access", async () => {
  const owner = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  try {
    const device = await connectDevice(owner, await provisionAccount(owner, false));
    const access = authentication.auth.devices;
    expect((await access.devices(device.token)).devices).toHaveLength(1);
    expect(await access.workbenches(device.token)).toEqual([]);
    expect(await access.keys(device.token, device.workbenchId)).toBeNull();
    await expect(access.addWorkbench(device.token, "another-project")).rejects.toThrow();
    await expect(authentication.auth.renew(device.token, device.workbenchId)).rejects.toThrow();
    const handler = implementation.createManagerHandler(authentication.auth, authentication.config.origin);
    const request = (path: string, body?: unknown) =>
      handler(
        new Request(`${authentication.config.origin}${path}`, {
          method: body ? "POST" : "GET",
          headers: { authorization: `Bearer ${device.token}`, "content-type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
    expect(await (await request("/v1/account")).json()).toEqual({ features: { relay: false } });
    expect(await (await request("/v1/workbenches")).json()).toEqual([]);
    expect((await request(`/v1/workbenches/${device.workbenchId}/keys`)).status).toBe(404);
    expect((await request("/v1/workbenches/new-project", {})).status).toBe(403);
    expect((await request("/v1/environment-access", { workbenchId: device.workbenchId })).status).toBe(401);
    expect((await request("/v1/devices/presence", {})).status).toBe(200);
    expect((await request(`/v1/devices/${device.deviceId}/rename`, { name: "Renamed without Cloud" })).status).toBe(
      200,
    );
    expect((await request(`/v1/devices/${device.deviceId}/remove`, {})).status).toBe(200);
  } finally {
    await Promise.all([owner.close(), authentication.close()]);
  }
});
