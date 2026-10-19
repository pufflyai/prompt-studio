import { strict as assert } from "node:assert";
import { connectDevice, createAuthorityFixture, deviceProfile, provisionAccount } from "../src/authority.fixture";
import { smokeAuthentication } from "./smoke-authentication";

const implementation: typeof import("../src/index") = await import(new URL("./authority.js", import.meta.url).href);
const fixture = createAuthorityFixture(implementation);
const owners: ReturnType<typeof implementation.createAccountManager>[] = [];
try {
  await fixture.initialize(new URL("./drizzle", import.meta.url).pathname);
  const first = fixture.owner();
  owners.push(first);
  const accountId = await provisionAccount(first);
  const device = await connectDevice(first, accountId);
  await first.close();
  const reopened = fixture.owner();
  owners.push(reopened);
  assert.deepEqual(await reopened.authorize(device.token, device.workbenchId), {
    accountId,
    workbenchId: device.workbenchId,
    deviceId: device.deviceId,
  });
  const snapshot = await reopened.snapshot();
  assert.ok(!JSON.stringify(snapshot).includes(device.token));
  await reopened.removeDevice({ accountId, deviceId: device.deviceId });
  assert.equal(await reopened.authorize(device.token, device.workbenchId), null);
  await reopened.restore("restore", snapshot);
  await reopened.reconcile({
    requestId: "current-authority",
    accountId,
    owner: { issuer: "https://accounts.google.com", subject: accountId },
    state: "active",
  });
  const fresh = await reopened.registerDevice({ accountId, ...deviceProfile(device.deviceId) });
  await reopened.restore("restore", snapshot);
  assert.ok(await reopened.authorize(fresh.token, device.workbenchId));
  await smokeAuthentication(fixture.databaseUrl, reopened, accountId);
  console.log("Built private manager authority, migrations, restart, device removal and restore passed");
} finally {
  await Promise.all(owners.map((owner) => owner.close()));
  await fixture.close();
}
