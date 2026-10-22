import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { Client } from "pg";
import { connectDevice, createAuthorityFixture, deviceProfile, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("a device reaches every cloud project of its account after restart, and nothing of another account", async () => {
  const first = fixture.owner();
  const [accountId, otherAccount] = await Promise.all([provisionAccount(first), provisionAccount(first)]);
  const device = await connectDevice(first, accountId, "shared-workbench-id");
  await first.addWorkbench({ accountId, workbenchId: "second-workbench" });
  const other = await connectDevice(first, otherAccount, "other-workbench");
  await first.close();
  const reopened = fixture.owner();
  try {
    for (const workbenchId of ["shared-workbench-id", "second-workbench"])
      expect(await reopened.authorize(device.token, workbenchId)).toEqual({
        accountId,
        workbenchId,
        deviceId: device.deviceId,
      });
    expect(await reopened.authorize(device.token, "other-workbench")).toBeNull();
    expect(await reopened.authorize(other.token, "shared-workbench-id")).toBeNull();
    expect(await reopened.authorize("unknown-credential", "shared-workbench-id")).toBeNull();
    expect((await reopened.workbenches(accountId)).map((row) => row.workbenchId)).toEqual([
      "second-workbench",
      "shared-workbench-id",
    ]);
  } finally {
    await reopened.close();
  }
});

test("logging in again replaces the device credential and keeps one device entry", async () => {
  const owner = fixture.owner();
  const sql = new SQL(fixture.databaseUrl);
  try {
    const accountId = await provisionAccount(owner);
    const first = await connectDevice(owner, accountId);
    const again = await owner.registerDevice({ accountId, ...deviceProfile(first.deviceId), platform: "darwin" });
    expect(await owner.authorize(first.token, first.workbenchId)).toBeNull();
    expect(await owner.authorize(again.token, first.workbenchId)).not.toBeNull();
    expect(await owner.devices(accountId)).toEqual([
      expect.objectContaining({ id: first.deviceId, name: "Fixture device", platform: "darwin" }),
    ]);
    const stored = await sql`SELECT digest FROM manager_devices WHERE "accountId" = ${accountId}`;
    expect(JSON.stringify(stored)).not.toContain(again.token);
    expect(await owner.authorize(stored[0].digest, first.workbenchId)).toBeNull();
  } finally {
    await Promise.all([owner.close(), sql.close()]);
  }
});

test("removing a device or a cloud project stops future access; logging in again restores the device", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const removed = await connectDevice(owner, accountId);
    const kept = await connectDevice(owner, accountId);
    await owner.removeDevice({ accountId, deviceId: removed.deviceId });
    await owner.removeDevice({ accountId, deviceId: removed.deviceId });
    expect(await owner.authorize(removed.token, removed.workbenchId)).toBeNull();
    expect(await owner.authorize(kept.token, kept.workbenchId)).not.toBeNull();
    expect((await owner.devices(accountId)).map((device) => device.id)).toEqual([kept.deviceId]);
    const restored = await owner.registerDevice({ accountId, ...deviceProfile(removed.deviceId) });
    expect(await owner.authorize(restored.token, removed.workbenchId)).not.toBeNull();
    await owner.removeWorkbench({ accountId, workbenchId: kept.workbenchId });
    expect(await owner.authorize(kept.token, kept.workbenchId)).toBeNull();
    expect(await owner.workbenches(accountId)).toEqual([]);
  } finally {
    await owner.close();
  }
});

test("disabling an account denies its devices and new logins after restart", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const device = await connectDevice(owner, accountId);
    const disable = { requestId: "disable", accountId };
    await owner.disable(disable);
    await owner.disable(disable);
    const reopened = fixture.owner();
    try {
      expect(await reopened.authorize(device.token, device.workbenchId)).toBeNull();
      await expect(reopened.registerDevice({ accountId, ...deviceProfile() })).rejects.toThrow("Device access");
    } finally {
      await reopened.close();
    }
  } finally {
    await owner.close();
  }
});

test("the ordinary relay role cannot connect to private manager authority", async () => {
  const own = new Client({ connectionString: fixture.relayContentUrl });
  const denied = new Client({ connectionString: fixture.relayUrl });
  try {
    await own.connect();
    expect((await own.query("SELECT current_user")).rowCount).toBe(1);
    await expect(denied.connect()).rejects.toMatchObject({ code: "42501" });
  } finally {
    await Promise.all([own.end(), denied.end()]);
  }
});
