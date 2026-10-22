import { afterAll, beforeAll, expect, test } from "bun:test";
import { connectDevice, createAuthorityFixture, deviceProfile, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const setup = (addresses?: Parameters<typeof createAuthenticationFixture>[1]) => {
  const authentication = createAuthenticationFixture(fixture.databaseUrl, addresses);
  const handler = implementation.createManagerHandler(authentication.auth, `${authentication.config.origin}/`);
  // A proxy in front of a manager under a path removes the path before forwarding.
  const request = (path: string, body?: unknown, headers?: HeadersInit) =>
    handler(
      new Request(`${new URL(authentication.config.origin).origin}${path}`, {
        method: body ? "POST" : "GET",
        headers: { "content-type": "application/json", ...Object.fromEntries(new Headers(headers)) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  const device = (token: string) => ({ authorization: `Bearer ${token}` });
  const renew = (token: string, workbenchId: string) =>
    request("/v1/environment-access", { workbenchId }, device(token));
  return { authentication, request, device, renew };
};

test("renewal returns sanitized scoped access and denies other workbenches", async () => {
  const manager = fixture.owner();
  const { authentication, request, renew } = setup();
  try {
    const accountId = await provisionAccount(manager);
    const grant = await connectDevice(manager, accountId);
    const issued = await request(
      "/v1/environment-access",
      { workbenchId: grant.workbenchId },
      { authorization: `bEaReR   ${grant.token}` },
    );
    expect(issued.status).toBe(200);
    expect(issued.headers.get("cache-control")).toBe("no-store");
    const access = (await issued.json()) as { token: string };
    const verify = implementation.createEnvironmentAccessVerifier({
      issuer: authentication.config.origin,
      audience: authentication.config.audience,
      jwks: await authentication.auth.jwks(),
    });
    expect(await verify(access.token)).toMatchObject({ accountId, environmentId: grant.deviceId });
    const denied = await renew(grant.token, "another-workbench");
    expect(denied.status).toBe(401);
    expect(await denied.text()).not.toContain(grant.token);
    expect(denied.headers.get("www-authenticate")).toBe("Bearer");
    expect((await request("/unknown")).status).toBe(404);
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});

test("Google login connects each device to every cloud project, and devices manage each other", async () => {
  const { authentication, request, device, renew } = setup();
  try {
    const user = await authentication.login(`devices-${crypto.randomUUID()}`);
    const stranger = await authentication.login(`stranger-${crypto.randomUUID()}`);
    const sameOrigin = new Headers(user.headers);
    sameOrigin.set("origin", authentication.config.origin);
    const login = async (headers: Headers, deviceId = crypto.randomUUID()) => {
      const response = await request("/v1/device-login", deviceProfile(deviceId), headers);
      expect(response.status).toBe(201);
      return (await response.json()) as { accountId: string; deviceId: string; token: string; relayOrigin: string };
    };
    expect((await request("/v1/device-login", deviceProfile(), user.headers)).status).toBe(403);
    const laptop = await login(sameOrigin);
    const desktop = await login(sameOrigin);
    expect(desktop.accountId).toBe(laptop.accountId);
    expect(laptop.relayOrigin).toBe(authentication.config.audience);
    const strangerOrigin = new Headers(stranger.headers);
    strangerOrigin.set("origin", authentication.config.origin);
    const other = await login(strangerOrigin);
    expect(other.accountId).not.toBe(laptop.accountId);

    const workbenchId = crypto.randomUUID();
    expect((await request(`/v1/workbenches/${workbenchId}`, {}, device(laptop.token))).status).toBe(200);
    expect(await (await request("/v1/workbenches", undefined, device(desktop.token))).json()).toEqual([
      { workbenchId },
    ]);
    expect((await renew(desktop.token, workbenchId)).status).toBe(200);
    expect((await renew(other.token, workbenchId)).status).toBe(401);

    const listed = (await (await request("/v1/devices", undefined, device(desktop.token))).json()) as {
      deviceId: string;
      devices: { id: string; name: string }[];
    };
    expect(listed.deviceId).toBe(desktop.deviceId);
    expect(listed.devices.map((entry) => entry.id).sort()).toEqual([laptop.deviceId, desktop.deviceId].sort());
    const strangerList = (await (await request("/v1/devices", undefined, device(other.token))).json()) as {
      devices: unknown[];
    };
    expect(strangerList.devices).toHaveLength(1);

    const rename = (id: string, name: unknown, token = desktop.token) =>
      request(`/v1/devices/${id}/rename`, { name }, device(token));
    expect((await rename(laptop.deviceId, "Work laptop")).status).toBe(200);
    expect((await rename(laptop.deviceId, " ")).status).toBe(400);
    expect((await rename(laptop.deviceId, "Taken over", other.token)).status).toBe(404);
    expect((await rename("unknown-device", "Nobody")).status).toBe(404);

    expect((await request(`/v1/devices/${laptop.deviceId}/remove`, {}, device(desktop.token))).status).toBe(200);
    expect((await renew(laptop.token, workbenchId)).status).toBe(401);
    expect((await request("/v1/devices", undefined, device(laptop.token))).status).toBe(401);
    const remaining = (await (await request("/v1/devices", undefined, device(desktop.token))).json()) as {
      devices: { id: string }[];
    };
    expect(remaining.devices.map((entry) => entry.id)).toEqual([desktop.deviceId]);

    expect((await request(`/v1/workbenches/${workbenchId}/remove`, {}, device(desktop.token))).status).toBe(200);
    expect((await renew(desktop.token, workbenchId)).status).toBe(401);
    expect((await request("/v1/devices")).status).toBe(401);
  } finally {
    await authentication.close();
  }
});

test("login finds the account an operator provisioned for the same Google user", async () => {
  const manager = fixture.owner();
  const { authentication, request } = setup();
  try {
    const accountId = await provisionAccount(manager);
    const user = await authentication.login(accountId);
    const headers = new Headers(user.headers);
    headers.set("origin", authentication.config.origin);
    const response = await request("/v1/device-login", deviceProfile(), headers);
    expect(response.status).toBe(201);
    expect(((await response.json()) as { accountId: string }).accountId).toBe(accountId);
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});

test("renewal under a path signs access for the full manager and relay addresses", async () => {
  const manager = fixture.owner();
  const addresses = { origin: "https://shared.fixture.test/accounts", audience: "https://shared.fixture.test/relay" };
  const { authentication, renew } = setup(addresses);
  try {
    const accountId = await provisionAccount(manager);
    const grant = await connectDevice(manager, accountId);
    const issued = await renew(grant.token, grant.workbenchId);
    expect(issued.status).toBe(200);
    const access = (await issued.json()) as { token: string };
    const verify = implementation.createEnvironmentAccessVerifier({
      issuer: addresses.origin,
      audience: addresses.audience,
      jwks: await authentication.auth.jwks(),
    });
    expect(await verify(access.token)).toMatchObject({ accountId, environmentId: grant.deviceId });
  } finally {
    await authentication.close();
  }
});
