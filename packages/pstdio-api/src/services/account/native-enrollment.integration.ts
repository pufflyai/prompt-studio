import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configSchema } from "../relay/config";
import { createAccountHostFixture } from "./native-host.fixture";

const root = await mkdtemp(join(tmpdir(), "native-owner-integration-"));
const origin = process.env.OWNER_TEST_ORIGIN!;
let app = await createAccountHostFixture(root);
console.log("NATIVE_RUNTIME_READY");
await Bun.stdin.stream().getReader().read();
const call = async <T = unknown>(path: string, method = "GET", body?: unknown) => {
  const response = await app.app.request(`/v1${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as T };
};
const login = async (cookie: string) => {
  const started = await call<{ id: string; url: string }>("/account/login", "POST", { managerOrigin: origin });
  assert.equal(started.status, 200);
  const url = new URL(started.body.url);
  url.pathname = "/v1/native-callback";
  const completed = await fetch(url, { headers: { cookie }, redirect: "manual" });
  assert.equal(completed.status, 302);
  const invalid = new URL(completed.headers.get("location")!);
  invalid.searchParams.set("state", "another-login-state");
  assert.equal((await fetch(invalid)).status, 400);
  assert.equal((await fetch(completed.headers.get("location")!)).status, 200);
  assert.equal((await call<{ status: string }>(`/account/login/${started.body.id}`)).body.status, "complete");
  const account = await call<{ accountId: string }>("/account/accounts", "POST", { managerOrigin: origin });
  assert.equal(account.status, 200);
  return account.body.accountId as string;
};
const connect = (workbenchId: string, accountId: string) =>
  call(`/projects/${workbenchId}/enrollment`, "PUT", {
    managerOrigin: origin,
    accountId,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
try {
  const first = await app.projects.create({ id: "transparent-workbench", name: "Offline first" });
  const second = await app.projects.create({ id: "built-network-workbench", name: "Second workbench" });
  const environment = (await app.deps.environmentService.get()).environmentId;
  const offlineOwner = { workbenchId: first.id, extensionId: "example.offline-notes" };
  const offline = await app.deps.extensionStorageService.open({ owner: offlineOwner });
  assert.equal(
    (
      await offline.records.commit({
        operationId: "before-enrollment",
        edits: [
          {
            recordId: "note",
            expectedRevision: (await offline.records.read("note")).revision,
            replace: "Saved while local-only",
          },
        ],
      })
    ).status,
    "saved-locally",
  );
  const offlineBefore = await offline.readState();
  const ownerA = await login(process.env.OWNER_TEST_COOKIE_A!);
  // Lose both the original registration and its replacement after their commits.
  assert.equal((await connect(first.id, ownerA)).status, 400);
  await app.close();
  app = await createAccountHostFixture(root);
  assert.equal((await connect(first.id, ownerA)).status, 400);
  assert.equal((await connect(first.id, ownerA)).status, 200);
  assert.deepEqual(
    await (await app.deps.extensionStorageService.open({ owner: offlineOwner })).readState(),
    offlineBefore,
  );
  const firstConfig = configSchema.parse(JSON.parse(await readFile(join(root, "relay-connections.json"), "utf8")))
    .connections[0];
  assert.equal((await connect(second.id, ownerA)).status, 200);
  let connections = (await call<{ workbenchId: string }[]>("/account/connections")).body;
  assert.equal(connections.length, 2);
  assert.ok(connections.every((entry: object) => !JSON.stringify(entry).includes("renewalGrant")));
  assert.equal(
    configSchema.parse(JSON.parse(await readFile(join(root, "relay-connections.json"), "utf8"))).connections[0]
      .renewalGrant,
    firstConfig.renewalGrant,
  );
  const ownerB = await login(process.env.OWNER_TEST_COOKIE_B!);
  assert.notEqual(ownerA, ownerB);
  assert.equal((await connect(first.id, ownerB)).status, 400);
  const third = await app.projects.create({ name: "Other owner" });
  assert.equal((await connect(third.id, ownerB)).status, 200);
  const owned = await call<unknown[]>(
    `/account/accounts/${ownerB}/environments?${new URLSearchParams({ managerOrigin: origin })}`,
  );
  assert.equal(owned.body.length, 1);
  const configBefore = await readFile(join(root, "relay-connections.json"), "utf8");
  await app.close();
  app = await createAccountHostFixture(root);
  assert.equal((await app.deps.environmentService.get()).environmentId, environment);
  assert.equal((await app.projects.get(first.id))?.id, first.id);
  const reopened = await app.deps.extensionStorageService.open({ owner: offlineOwner });
  assert.deepEqual(await reopened.readState(), offlineBefore);
  connections = (await call<{ workbenchId: string }[]>("/account/connections")).body;
  assert.equal(connections.length, 3);
  assert.equal(await readFile(join(root, "relay-connections.json"), "utf8"), configBefore);
  const inspection = await call<{ accounts: { accountId: string }[] }>(
    `/account?${new URLSearchParams({ managerOrigin: origin })}`,
  );
  assert.equal(inspection.body.accounts[0].accountId, ownerB);
  assert.ok(!JSON.stringify(inspection.body).includes(firstConfig.renewalGrant));
  assert.equal(
    (await call(`/account/accounts/${ownerB}/environments/${environment}/revoke`, "POST", { managerOrigin: origin }))
      .status,
    200,
  );
  const beforeReconnect = configSchema.parse(
    JSON.parse(await readFile(join(root, "relay-connections.json"), "utf8")),
  ).connections;
  const oldGrant = beforeReconnect.find((entry) => entry.workbenchId === third.id)!.renewalGrant;
  assert.equal((await connect(third.id, ownerB)).status, 200);
  const afterReconnect = configSchema.parse(
    JSON.parse(await readFile(join(root, "relay-connections.json"), "utf8")),
  ).connections;
  assert.ok(
    afterReconnect.find((entry) => entry.workbenchId === third.id)!.renewalGrant !== oldGrant,
    "Revoked enrollment obtains new renewal authority",
  );
  assert.equal(afterReconnect.find((entry) => entry.workbenchId === first.id)!.renewalGrant, firstConfig.renewalGrant);
  assert.equal((await fetch(new URL("/fixture/renewal-outage", origin))).status, 200);
  assert.equal((await connect(third.id, ownerB)).status, 400);
  assert.deepEqual(
    configSchema.parse(JSON.parse(await readFile(join(root, "relay-connections.json"), "utf8"))).connections,
    afterReconnect,
  );
  assert.equal((await call("/account/sign-out", "POST", { managerOrigin: origin })).status, 200);
  assert.equal((await call(`/account?${new URLSearchParams({ managerOrigin: origin })}`)).status, 400);
  assert.equal((await call<{ workbenchId: string }[]>("/account/connections")).body.length, 3);
  console.log(
    JSON.stringify({
      managerOrigin: origin,
      ownerA,
      ownerB,
      environmentId: environment,
      workbenchIds: [first.id, second.id, third.id],
    }),
  );
  console.log(
    "Native host: two owners, three workbenches, lost-response replacement, mismatch denial, secret redaction, restart and sign-out passed",
  );
} finally {
  await app.close();
  await rm(root, { recursive: true, force: true });
}
