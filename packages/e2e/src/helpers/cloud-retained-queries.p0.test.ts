import { expect, test } from "bun:test";
import { accountEvents } from "@pstdio/sdk/extensions";
import { createCloudQueries } from "pstdio-cloud/testing";
import { cloudAccount, cloudDevice, cloudQueryFixture } from "./cloud-retained-query.fixture";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("another project's sync event does not refresh the selected Cloud view or load optional devices", async () => {
  const f = cloudQueryFixture();
  try {
    await f.open();
    f.emit(accountEvents.projectSyncChanged.id, "other");
    await turn();
    expect(f.reads).toEqual({ status: 1, sync: 1, devices: 0 });
    f.detach();
    f.observe(f.queries.account);
    f.observe(f.queries.projectSync);
    await turn();
    expect(f.reads).toEqual({ status: 1, sync: 1, devices: 0 });
  } finally {
    await f.dispose();
  }
});

test("sync notifications cannot discard an admitted device refresh after a rename", async () => {
  const f = cloudQueryFixture();
  const pending = f.holdDevices();
  try {
    await f.open();
    const devices = f.queries.devices(cloudAccount.login!);
    f.observe(devices);
    await turn();
    f.setSync({ state: "offline", offlineReady: true });
    f.emit(accountEvents.projectSyncChanged.id, "project");
    await turn();
    pending.resolve([{ ...cloudDevice, name: "Renamed" }]);
    await devices.read();
    await f.queries.projectSync.read();
    expect(devices.getSnapshot().data?.[0]?.name).toBe("Renamed");
    expect(f.queries.projectSync.getSnapshot().data?.state).toBe("offline");
    expect(f.reads.devices).toBe(1);
  } finally {
    pending.resolve([]);
    await f.dispose();
  }
});

test("device refresh waits for the newest account read when sync changes arrive during it", async () => {
  const f = cloudQueryFixture();
  let pending: ReturnType<typeof f.holdStatus> | undefined;
  try {
    await f.open();
    const devices = await f.devices();
    f.setDevices([{ ...cloudDevice, name: "Renamed" }]);
    pending = f.holdStatus();
    f.refreshAccount();
    f.invalidate(devices);
    await turn();
    expect(f.reads.devices).toBe(1);
    f.emit(accountEvents.projectSyncChanged.id, "project");
    pending.resolve(cloudAccount);
    await turn();
    await devices.read();
    expect(devices.getSnapshot().data?.[0]?.name).toBe("Renamed");
    expect(f.reads.devices).toBe(2);
  } finally {
    pending?.resolve(cloudAccount);
    await f.dispose();
  }
});

test("a different account manager cannot reuse a colliding account's accepted devices", async () => {
  const f = cloudQueryFixture();
  try {
    await f.open();
    const previous = await f.devices();
    const next = { ...cloudAccount, login: { ...cloudAccount.login!, managerOrigin: "https://second.test" } };
    f.setAccount(next);
    f.accountChanged();
    await f.account.read();
    expect(previous.getSnapshot().data).toBeUndefined();
    const current = f.queries.devices(next.login);
    expect(current).not.toBe(previous);
    expect(current.getSnapshot().data).toBeUndefined();
    f.failDevices();
    f.observe(current);
    await expect(current.read()).rejects.toThrow("New manager unavailable");
    expect(current.getSnapshot().data).toBeUndefined();
    expect(current.getSnapshot().error?.message).toBe("New manager unavailable");
    expect(f.reads.devices).toBe(2);
  } finally {
    await f.dispose();
  }
});

test("sync bursts coalesce a held project read without rereading account status", async () => {
  const f = cloudQueryFixture();
  const initial = f.holdSync();
  try {
    f.observe(f.queries.account);
    f.observe(f.queries.projectSync);
    f.setSync({ state: "offline", offlineReady: true });
    for (let event = 0; event < 50; event++) f.emit(accountEvents.projectSyncChanged.id, "project");
    await f.account.read();
    expect(f.reads.status).toBe(1);
    initial.resolve({ state: "synced", offlineReady: true });
    await f.queries.projectSync.read();
    expect(f.queries.projectSync.getSnapshot().data?.state).toBe("offline");
    expect(f.reads).toEqual({ status: 1, sync: 2, devices: 0 });
  } finally {
    initial.resolve({ state: "synced", offlineReady: true });
    await f.dispose();
  }
});

test("queued account changes cannot publish obsolete status with another account's devices", async () => {
  const f = cloudQueryFixture();
  let stale: ReturnType<typeof f.holdStatus> | undefined;
  let current: ReturnType<typeof f.holdStatus> | undefined;
  try {
    await f.open();
    const previousDevices = await f.devices();
    stale = f.holdStatus();
    current = f.holdStatus();
    f.refreshAccount();
    await turn();
    await stale.entered;
    f.accountChanged();
    stale.resolve(cloudAccount);
    await current.entered;
    expect(f.reads.status).toBe(3);
    expect(f.reads.devices).toBe(1);
    expect(f.queries.account.getSnapshot().data?.login?.accountId).toBe("a");
    const next = { ...cloudAccount, login: { ...cloudAccount.login!, accountId: "b" } };
    f.setAccount(next);
    f.setDevices([{ ...cloudDevice, name: "Account B device" }]);
    current.resolve(next);
    await f.account.read();
    expect(previousDevices.getSnapshot().data).toBeUndefined();
    const nextDevices = await f.devices();
    expect(nextDevices.getSnapshot().data?.[0]?.name).toBe("Account B device");
    expect(f.reads.devices).toBe(2);
  } finally {
    stale?.resolve(cloudAccount);
    current?.resolve(cloudAccount);
    await f.dispose();
  }
});

test("inactive Cloud views stay quiet and authority retirement clears every private query", async () => {
  const f = cloudQueryFixture();
  try {
    await f.open();
    const devices = await f.devices();
    f.detach();
    f.accountChanged();
    await f.account.read();
    expect(f.reads).toEqual({ status: 2, sync: 1, devices: 1 });
    const previousAccount = f.queries.account;
    f.authority("b", "https://second.test");
    expect(f.queries.account.getSnapshot().data).toBeUndefined();
    expect(devices.getSnapshot().data).toBeUndefined();
    const returning = createCloudQueries(f.client, "project");
    expect(returning.account).not.toBe(previousAccount);
    expect(returning.account.getSnapshot().data).toBeUndefined();
    expect(f.client.queries.inspect()).toEqual({ active: 0, retained: 0 });
  } finally {
    await f.dispose();
  }
});
