import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { call, devices, login, type Status, token } from "./native-device-sign-in.fixture";
import { createAccountHostFixture } from "./native-host.fixture";

const origin = process.env.OWNER_TEST_ORIGIN!;
const roots = await Promise.all([1, 2].map(() => mkdtemp(join(tmpdir(), "native-device-"))));
let laptop = await createAccountHostFixture(roots[0]);
let desktop = await createAccountHostFixture(roots[1]);
console.log("NATIVE_RUNTIME_READY");
await Bun.stdin.stream().getReader().read();

const renew = async (credential: string, workbenchId: string) =>
  (
    await fetch(new URL("/v1/environment-access", origin), {
      method: "POST",
      headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
      body: JSON.stringify({ workbenchId }),
    })
  ).status;

try {
  const project = await laptop.projects.create({ name: "Shared notes" });
  const owner = { workbenchId: project.id, extensionId: "example.offline-notes" };
  const offline = await laptop.deps.extensionStorageService.open({ owner });
  const saved = await offline.records.commit({
    operationId: "before-login",
    edits: [
      {
        recordId: "note",
        expectedRevision: (await offline.records.read("note")).revision,
        replace: "Saved while local-only",
      },
    ],
  });
  assert.equal(saved.status, "saved-locally");
  const offlineBefore = await offline.records.list();

  assert.equal((await call<{ error: string }>(laptop, "/account/devices")).body.error, "Log in first with pst login");
  const laptopLogin = await login(laptop, origin, process.env.OWNER_TEST_SUBJECT_A!);
  assert.equal(laptopLogin.deviceId, (await laptop.deps.environmentService.get()).environmentId);
  assert.equal((await call(laptop, `/account/projects/${project.id}`, "PUT")).status, 200);
  assert.deepEqual(
    laptop.synced().map((entry) => entry.workbenchId),
    [project.id],
  );

  // The second device binds the same project and logs in. No per-project step connects it.
  await desktop.projects.create({ id: project.id, name: "Shared notes" });
  const desktopLogin = await login(desktop, origin, process.env.OWNER_TEST_SUBJECT_A!);
  assert.equal(desktopLogin.accountId, laptopLogin.accountId);
  assert.notEqual(desktopLogin.deviceId, laptopLogin.deviceId);
  assert.deepEqual((await call<Status>(desktop, "/account")).body.cloudProjects, [project.id]);
  assert.deepEqual(
    desktop.synced().map((entry) => [entry.workbenchId, entry.environmentId]),
    [[project.id, desktopLogin.deviceId]],
  );
  for (const host of [laptop, desktop]) {
    const listed = await devices(host);
    assert.deepEqual(listed.map((device) => device.id).sort(), [laptopLogin.deviceId, desktopLogin.deviceId].sort());
    assert.equal(listed.filter((device) => device.current).length, 1);
    assert.ok(
      listed.every((device) => device.online),
      "Both active native devices have live presence",
    );
  }
  const rename = { name: "Work laptop" };
  assert.equal((await call(desktop, `/account/devices/${laptopLogin.deviceId}/rename`, "POST", rename)).status, 200);
  assert.equal((await devices(laptop)).find((device) => device.current)?.name, "Work laptop");

  // Removing a device stops its renewal. The removed device notices on its next manager request and stops syncing.
  const laptopToken = (await token(laptop))!;
  assert.equal(await renew(laptopToken, project.id), 200);
  assert.equal((await call(desktop, `/account/devices/${laptopLogin.deviceId}/remove`, "POST")).status, 200);
  assert.equal(await renew(laptopToken, project.id), 401);
  const removedCall = await call<{ error: string }>(laptop, "/account/devices");
  assert.equal(removedCall.status, 400);
  assert.match(removedCall.body.error, /removed from your account/);
  assert.equal((await call<Status>(laptop, "/account")).body.login, null);
  assert.deepEqual(laptop.synced(), []);
  assert.deepEqual(
    (await devices(desktop)).map((device) => device.id),
    [desktopLogin.deviceId],
  );

  // A restarted device keeps its login and reconnects its cloud projects.
  await desktop.close();
  desktop = await createAccountHostFixture(roots[1]);
  assert.deepEqual(
    desktop.synced().map((entry) => entry.workbenchId),
    [project.id],
  );
  assert.equal((await call(desktop, `/account/projects/${project.id}`, "DELETE")).status, 200);
  assert.deepEqual(desktop.synced(), []);
  const desktopToken = (await token(desktop))!;
  assert.equal(await renew(desktopToken, project.id), 401);
  assert.deepEqual((await call(desktop, "/account/logout", "POST")).body, { ok: true, removed: true });
  assert.equal((await call<Status>(desktop, "/account")).body.login, null);
  assert.equal(await token(desktop), undefined);

  // Another Google user on the same client gets their own account and sees only their own devices.
  const otherLogin = await login(laptop, origin, process.env.OWNER_TEST_SUBJECT_B!);
  assert.notEqual(otherLogin.accountId, laptopLogin.accountId);
  assert.deepEqual(
    (await devices(laptop)).map((device) => device.id),
    [otherLogin.deviceId],
  );
  assert.deepEqual((await call<Status>(laptop, "/account")).body.cloudProjects, []);

  await laptop.close();
  laptop = await createAccountHostFixture(roots[0]);
  const reopened = await laptop.deps.extensionStorageService.open({ owner });
  assert.deepEqual(await reopened.records.list(), offlineBefore);
  console.log(
    "Native devices: two-device login, device list, rename, removal, restart, cloud project on and off, logout and a second user passed",
  );
} finally {
  await Promise.all([laptop.close(), desktop.close()]);
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
}
