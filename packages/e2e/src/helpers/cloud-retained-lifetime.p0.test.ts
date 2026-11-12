import { expect, test } from "bun:test";
import { createCloudQueries } from "../../../../extensions/pstdio-cloud/src/cloud-queries";
import { cloudAccount, cloudDevice, cloudQueryFixture } from "./cloud-retained-query.fixture";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("detached device views do not continue through an unrelated required account read", async () => {
  const f = cloudQueryFixture();
  let pending: ReturnType<typeof f.holdStatus> | undefined;
  try {
    await f.open();
    const devices = await f.devices();
    pending = f.holdStatus();
    f.refreshAccount();
    f.invalidate(devices);
    await turn();
    const required = f.readAccount();
    f.detach();
    pending.resolve(cloudAccount);
    await required;
    await turn();
    await turn();
    expect(f.reads.devices).toBe(1);
  } finally {
    pending?.resolve(cloudAccount);
    await f.dispose();
  }
});

test("retiring one project cannot fail a surviving project's shared device read", async () => {
  const f = cloudQueryFixture("first");
  let pending: ReturnType<typeof f.holdStatus> | undefined;
  let stopProject = () => {};
  let stopAccount = () => {};
  let stopDevices = () => {};
  try {
    await f.open();
    const devices = await f.devices();
    pending = f.holdStatus();
    f.setDevices([{ ...cloudDevice, name: "Fresh" }]);
    f.refreshAccount();
    f.invalidate(devices);
    await turn();
    expect(f.reads.devices).toBe(1);
    const second = createCloudQueries(f.client, "second");
    const sharedDevices = second.devices(cloudAccount.login!);
    expect(sharedDevices).toBe(devices);
    stopProject = second.projectSync.subscribe(() => {});
    stopAccount = second.account.subscribe(() => {});
    stopDevices = sharedDevices.subscribe(() => {});
    f.detach();
    f.retireProject();
    pending.resolve(cloudAccount);
    await sharedDevices.read();
    expect(sharedDevices.getSnapshot().error).toBeUndefined();
    expect(sharedDevices.getSnapshot().data?.[0]?.name).toBe("Fresh");
    expect(f.reads.status).toBe(2);
    expect(f.reads.devices).toBe(2);
  } finally {
    pending?.resolve(cloudAccount);
    stopDevices();
    stopProject();
    stopAccount();
    await f.dispose();
  }
});

test("a newly accepted account error fences the device continuation while cached login remains", async () => {
  const f = cloudQueryFixture();
  let pending: ReturnType<typeof f.holdStatus> | undefined;
  let stopFailure = () => {};
  try {
    await f.open();
    const devices = await f.devices();
    pending = f.holdStatus();
    f.refreshAccount();
    f.invalidate(devices);
    await turn();
    let failed = false;
    stopFailure = f.queries.account.subscribe(() => {
      const status = f.queries.account.getSnapshot();
      if (failed || status.fetching || !status.data || status.error) return;
      failed = true;
      f.account.reportError(new Error("Account status unavailable"));
    });
    pending.resolve(cloudAccount);
    await expect(devices.read()).rejects.toThrow("Account status unavailable");
    expect(f.queries.account.getSnapshot().data).toEqual(cloudAccount);
    expect(devices.getSnapshot().error?.message).toBe("Account status unavailable");
    expect(f.reads.devices).toBe(1);
  } finally {
    pending?.resolve(cloudAccount);
    stopFailure();
    await f.dispose();
  }
});
