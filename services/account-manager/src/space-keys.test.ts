import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { type SpaceKeys, spaceKeysPath, spaceKeysSchema } from "pstdio-sync-contracts";
import { connectDevice, createAuthorityFixture, deviceProfile, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const setup = () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const handler = implementation.createManagerHandler(authentication.auth, authentication.config.origin);
  const request = (path: string, token: string, body?: unknown) =>
    handler(
      new Request(`${authentication.config.origin}${path}`, {
        method: body ? "POST" : "GET",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  const keys = async (token: string, workbenchId: string) => {
    const response = await request(spaceKeysPath(workbenchId), token);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    return spaceKeysSchema.parse(await response.json());
  };
  return { manager, request, keys, close: () => Promise.all([manager.close(), authentication.close()]) };
};
const generations = (keys: SpaceKeys) => ({
  project: keys.project.map((key) => key.generation),
  personal: keys.personal.map((key) => key.generation),
});

test("every device of a user gets the same project and personal keys for a cloud project", async () => {
  const { manager, request, keys, close } = setup();
  try {
    const accountId = await provisionAccount(manager);
    const laptop = await connectDevice(manager, accountId);
    const desktop = await manager.registerDevice({ accountId, ...deviceProfile() });
    const laptopKeys = await keys(laptop.token, laptop.workbenchId);
    expect(await keys(desktop.token, laptop.workbenchId)).toEqual(laptopKeys);
    expect(generations(laptopKeys)).toEqual({ project: [1], personal: [1] });
    expect(laptopKeys.project[0].secret).not.toBe(laptopKeys.personal[0].secret);

    // Another user's project with the same ID has its own keys, and unknown projects have none.
    const stranger = await connectDevice(manager, await provisionAccount(manager), laptop.workbenchId);
    expect((await keys(stranger.token, laptop.workbenchId)).project).not.toEqual(laptopKeys.project);
    expect((await request(spaceKeysPath("unknown-workbench"), laptop.token)).status).toBe(404);
    expect((await request(spaceKeysPath(laptop.workbenchId), "not-a-device-credential")).status).toBe(401);
  } finally {
    await close();
  }
});

test("removing a device creates new keys for future data and keeps older keys for remaining devices", async () => {
  const { manager, request, keys, close } = setup();
  try {
    const accountId = await provisionAccount(manager);
    const laptop = await connectDevice(manager, accountId);
    const desktop = await manager.registerDevice({ accountId, ...deviceProfile() });
    const before = await keys(desktop.token, laptop.workbenchId);

    expect((await request(`/v1/devices/${laptop.deviceId}/remove`, desktop.token, {})).status).toBe(200);
    expect((await request(spaceKeysPath(laptop.workbenchId), laptop.token)).status).toBe(401);
    const after = await keys(desktop.token, laptop.workbenchId);
    expect(generations(after)).toEqual({ project: [1, 2], personal: [1, 2] });
    expect(after.project[0]).toEqual(before.project[0]);
    expect(after.personal[0]).toEqual(before.personal[0]);
    expect(after.project[1].secret).not.toBe(before.project[0].secret);

    // Removing a device that is already gone is not a membership change.
    await manager.removeDevice({ accountId, deviceId: laptop.deviceId });
    expect(generations(await keys(desktop.token, laptop.workbenchId))).toEqual({ project: [1, 2], personal: [1, 2] });
  } finally {
    await close();
  }
});

test("a manager restore brings back every key generation after the key store is lost", async () => {
  const { manager, keys, close } = setup();
  try {
    const accountId = await provisionAccount(manager);
    const laptop = await connectDevice(manager, accountId);
    const desktop = await manager.registerDevice({ accountId, ...deviceProfile() });
    await manager.removeDevice({ accountId, deviceId: laptop.deviceId });
    const saved = await keys(desktop.token, laptop.workbenchId);
    const snapshot = await manager.snapshot();

    const database = new SQL(fixture.databaseUrl);
    await database`DELETE FROM manager_space_keys`;
    await database.close();
    await manager.restore(`restore-keys-${crypto.randomUUID()}`, snapshot);
    await manager.reconcile({
      requestId: `reactivate-${crypto.randomUUID()}`,
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    const returning = await manager.registerDevice({ accountId, ...deviceProfile() });
    expect(await keys(returning.token, laptop.workbenchId)).toEqual(saved);
  } finally {
    await close();
  }
});
