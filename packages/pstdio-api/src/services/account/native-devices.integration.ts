import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAccountHostFixture } from "./native-host.fixture";

type Host = Awaited<ReturnType<typeof createAccountHostFixture>>;
type Device = { id: string; name: string; current: boolean; online: boolean };
type Status = { login: { accountId: string; deviceId: string } | null; cloudProjects: string[] };

const origin = process.env.OWNER_TEST_ORIGIN!;
const roots = await Promise.all([1, 2].map(() => mkdtemp(join(tmpdir(), "native-device-"))));
let laptop = await createAccountHostFixture(roots[0]);
let desktop = await createAccountHostFixture(roots[1]);
console.log("NATIVE_RUNTIME_READY");
await Bun.stdin.stream().getReader().read();

const call = async <T = unknown>(host: Host, path: string, method = "GET", body?: unknown) => {
  const response = await host.app.request(`/v1${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text) as T, text };
};
const token = async (host: Host) =>
  (JSON.parse(await readFile(host.file, "utf8")) as { login: { token: string } | null }).login?.token;
const renew = async (credential: string, workbenchId: string) =>
  (
    await fetch(new URL("/v1/environment-access", origin), {
      method: "POST",
      headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
      body: JSON.stringify({ workbenchId }),
    })
  ).status;
// Completes the browser step with a Google session cookie, then lets the loopback callback finish the login.
const login = async (host: Host, cookie: string) => {
  const started = await call<{ id: string; url: string }>(host, "/account/login", "POST", { managerOrigin: origin });
  assert.equal(started.status, 200);
  const url = new URL(started.body.url);
  url.pathname = "/v1/native-callback";
  const completed = await fetch(url, { headers: { cookie }, redirect: "manual" });
  assert.equal(completed.status, 302);
  const invalid = new URL(completed.headers.get("location")!);
  invalid.searchParams.set("state", "another-login-state");
  assert.equal((await fetch(invalid)).status, 400);
  assert.equal((await fetch(completed.headers.get("location")!)).status, 200);
  assert.equal((await call<{ status: string }>(host, `/account/login/${started.body.id}`)).body.status, "complete");
  // Sign-in completes at credential persistence; discovery runs without delaying its callback.
  await host.account.refresh();
  const status = await call<Status>(host, "/account");
  assert.ok(status.body.login);
  assert.ok(!status.text.includes((await token(host))!), "The device credential never leaves the native host");
  return status.body.login;
};
const devices = async (host: Host) => (await call<Device[]>(host, "/account/devices")).body;

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
  const offlineBefore = await offline.exportUpdate();

  assert.equal((await call<{ error: string }>(laptop, "/account/devices")).body.error, "Log in first with pst login");
  const laptopLogin = await login(laptop, process.env.OWNER_TEST_COOKIE_A!);
  assert.equal(laptopLogin.deviceId, (await laptop.deps.environmentService.get()).environmentId);
  assert.equal((await call(laptop, `/account/projects/${project.id}`, "PUT")).status, 200);
  assert.deepEqual(
    laptop.synced().map((entry) => entry.workbenchId),
    [project.id],
  );

  // The second device binds the same project and logs in. No per-project step connects it.
  await desktop.projects.create({ id: project.id, name: "Shared notes" });
  const desktopLogin = await login(desktop, process.env.OWNER_TEST_COOKIE_A_AGAIN!);
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
  const otherLogin = await login(laptop, process.env.OWNER_TEST_COOKIE_B!);
  assert.notEqual(otherLogin.accountId, laptopLogin.accountId);
  assert.deepEqual(
    (await devices(laptop)).map((device) => device.id),
    [otherLogin.deviceId],
  );
  assert.deepEqual((await call<Status>(laptop, "/account")).body.cloudProjects, []);

  await laptop.close();
  laptop = await createAccountHostFixture(roots[0]);
  const reopened = await laptop.deps.extensionStorageService.open({ owner });
  assert.deepEqual(await reopened.exportUpdate(), offlineBefore);
  console.log(
    "Native devices: two-device login, device list, rename, removal, restart, cloud project on and off, logout and a second user passed",
  );
} finally {
  await Promise.all([laptop.close(), desktop.close()]);
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
}
