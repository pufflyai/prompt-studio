import { afterAll, beforeAll, expect, test } from "bun:test";
import { parseManagerAuthConfig } from "./auth-config";
import { connectDevice, createAuthorityFixture, deviceProfile, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
const relayToken = "disposable-relay-deletion-credential-fixture";
const config = () => ({ ...authenticationConfig(fixture.databaseUrl), projectDeletionRelayToken: relayToken });

beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const request = (
  manager: ReturnType<typeof implementation.createManagerAuthentication>,
  path: string,
  token: string,
  method = "GET",
  body: unknown = method === "POST" && path.startsWith("/v1/") ? { confirm: true } : undefined,
) =>
  implementation.createManagerHandler(
    manager,
    config().origin,
  )(
    new Request(config().origin + path, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );

const servicePath = "/internal/v1/project-deletions";
const projectPath = (id: string) => `/v1/workbenches/${id}/deletion`;

test("deletion uses credentials accepted by the HTTP Bearer scheme", () => {
  expect(() => parseManagerAuthConfig({ ...config(), projectDeletionRelayToken: `${relayToken}🔑` })).toThrow(
    "Invalid authentication configuration",
  );
  expect(parseManagerAuthConfig(config()).projectDeletionRelayToken).toBe(relayToken);
});

test("a malformed project deletion path returns a bad request", async () => {
  const owner = fixture.owner();
  const manager = implementation.createManagerAuthentication(config());
  try {
    const device = await connectDevice(owner, await provisionAccount(owner));
    for (const malformed of ["%FF", "%00"].map(projectPath)) {
      expect((await request(manager, malformed, device.token)).status).toBe(400);
      expect((await request(manager, malformed, device.token, "POST")).status).toBe(400);
    }
  } finally {
    await Promise.all([owner.close(), manager.close()]);
  }
});

test("permanent deletion retires authority at acceptance and completes only after the relay purge", async () => {
  const owner = fixture.owner();
  const manager = implementation.createManagerAuthentication(config());
  const restarted = implementation.createManagerAuthentication(config());
  try {
    const accountId = await provisionAccount(owner);
    const retired = await connectDevice(owner, accountId, "retired");
    const local = await connectDevice(owner, accountId, "make-local");
    const revoked = await owner.registerDevice({ accountId, ...deviceProfile() });
    const outsider = await connectDevice(owner, await provisionAccount(owner), retired.workbenchId);
    const path = projectPath(retired.workbenchId);
    const localKeys = await manager.devices.keys(local.token, local.workbenchId);
    const outsiderKeys = await manager.devices.keys(outsider.token, outsider.workbenchId);
    expect(await manager.devices.keys(retired.token, retired.workbenchId)).not.toBeNull();
    const staleSnapshot = await owner.snapshot();

    // Another account cannot obtain or affect the receipt for this scope.
    expect((await request(manager, projectPath("make-local"), outsider.token, "POST")).status).toBe(404);
    await owner.removeDevice({ accountId, deviceId: revoked.deviceId });
    expect((await request(manager, path, revoked.token, "POST")).status).toBe(401);

    expect((await request(manager, path, retired.token, "POST", {})).status).toBe(400);
    const accepted = await request(manager, path, retired.token, "POST");
    expect(accepted.status).toBe(202);
    const operation = await accepted.json();
    expect(operation).toMatchObject({ workbenchId: retired.workbenchId, state: "deleting" });
    expect(await (await request(restarted, path, retired.token, "POST")).json()).toEqual(operation);
    expect((await request(restarted, path, revoked.token)).status).toBe(401);
    expect((await request(restarted, path, outsider.token)).status).toBe(404);
    expect(await (await request(restarted, "/v1/project-deletions", retired.token)).json()).toEqual([operation]);
    expect(await restarted.devices.workbenches(retired.token)).toEqual([{ workbenchId: local.workbenchId }]);
    expect(await restarted.devices.keys(retired.token, retired.workbenchId)).toBeNull();
    await expect(restarted.renew(retired.token, retired.workbenchId)).rejects.toThrow();
    await expect(restarted.devices.addWorkbench(retired.token, retired.workbenchId)).rejects.toThrow();
    await expect(owner.addWorkbench({ accountId, workbenchId: retired.workbenchId })).rejects.toThrow("retired");

    expect((await request(restarted, servicePath, retired.token)).status).toBe(401);
    const scope = { accountId, workbenchId: retired.workbenchId, operationId: operation.operationId };
    const jobs = await (await request(restarted, servicePath, relayToken)).json();
    expect(jobs).toContainEqual({ ...scope, delivery: 1 });
    const failedDelivery = { ...scope, result: "needs-attention", delivery: 1 };
    expect((await request(restarted, servicePath, retired.token, "POST", failedDelivery)).status).toBe(401);
    expect((await request(restarted, servicePath, relayToken, "POST", { ...scope, result: "purged" })).status).toBe(
      400,
    );
    expect((await request(restarted, servicePath, relayToken, "POST", failedDelivery)).status).toBe(200);
    expect(await (await request(restarted, path, retired.token)).json()).toMatchObject({
      operationId: operation.operationId,
      state: "needs-attention",
    });
    expect(await (await request(restarted, path, retired.token, "POST")).json()).toEqual(operation);

    expect(await (await request(restarted, servicePath, relayToken)).json()).toContainEqual({
      ...scope,
      delivery: 2,
    });
    expect(await (await request(restarted, servicePath, relayToken, "POST", failedDelivery)).json()).toEqual(operation);

    const acknowledgement = { ...scope, result: "purged", writeBarrier: true };
    expect((await request(restarted, servicePath, relayToken, "POST", acknowledgement)).status).toBe(200);
    const completed = await (await request(restarted, path, retired.token)).json();
    expect(completed).toMatchObject({ operationId: operation.operationId, state: "completed" });
    expect(await (await request(restarted, servicePath, relayToken, "POST", acknowledgement)).json()).toEqual(
      completed,
    );
    expect((await request(restarted, path, retired.token, "POST")).status).toBe(200);
    expect(await (await request(restarted, "/v1/project-deletions", retired.token)).json()).toEqual([]);
    expect(await (await request(restarted, servicePath, relayToken, "POST", failedDelivery)).json()).toEqual(completed);
    expect(
      (await owner.snapshot()).keys.some(
        (row) => row.accountId === accountId && row.workbenchId === retired.workbenchId,
      ),
    ).toBe(false);
    expect(await restarted.devices.keys(outsider.token, outsider.workbenchId)).toEqual(outsiderKeys);

    await restarted.devices.removeWorkbench(local.token, local.workbenchId);
    await restarted.devices.addWorkbench(local.token, local.workbenchId);
    const resumedKeys = await restarted.devices.keys(local.token, local.workbenchId);
    expect(resumedKeys?.project[0]).toEqual(localKeys?.project[0]);

    await owner.restore("stale-project-authority", staleSnapshot);
    await owner.reconcile({
      requestId: "reconcile-after-project-restore",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    const recovered = await owner.registerDevice({ accountId, ...deviceProfile() });
    expect(await (await request(restarted, path, recovered.token)).json()).toEqual(completed);
    expect(await restarted.devices.workbenches(recovered.token)).toEqual([{ workbenchId: local.workbenchId }]);
    expect(await restarted.devices.keys(recovered.token, retired.workbenchId)).toBeNull();
    expect(
      (await owner.snapshot()).keys.some(
        (row) => row.accountId === accountId && row.workbenchId === retired.workbenchId,
      ),
    ).toBe(false);
    const freshScope = crypto.randomUUID();
    await restarted.devices.addWorkbench(recovered.token, freshScope);
    expect(await restarted.devices.keys(recovered.token, freshScope)).not.toBeNull();
  } finally {
    await Promise.all([owner.close(), manager.close(), restarted.close()]);
  }
});

test("fresh restore retires membership and retains project keys until relay verification", async () => {
  const owner = fixture.owner();
  const target = createAuthorityFixture(implementation);
  const manager = implementation.createManagerAuthentication(config());
  try {
    await target.initialize();
    const restored = target.owner();
    try {
      const accountId = await provisionAccount(owner);
      const device = await connectDevice(owner, accountId, "restored-retirement");
      const path = projectPath(device.workbenchId);
      await manager.devices.keys(device.token, device.workbenchId);
      const before = await owner.snapshot();
      const operation = await (await request(manager, path, device.token, "POST")).json();
      const pending = await owner.snapshot();
      await restored.restore("backup-after-acceptance", pending);
      const pendingRestore = await restored.snapshot();
      const projectKeys = pending.keys.filter((row) => row.accountId === accountId);
      expect(projectKeys.length).toBeGreaterThan(0);
      expect(pendingRestore.keys.filter((row) => row.accountId === accountId)).toEqual(projectKeys);
      expect(pendingRestore.deletions).toContainEqual({ accountId, ...operation, delivery: 1 });
      await restored.restore("backup-before-deletion", before);
      expect(await restored.workbenches(accountId)).toEqual([]);
      expect((await restored.snapshot()).workbenches).not.toContainEqual({ accountId, id: device.workbenchId });
      await expect(restored.addWorkbench({ accountId, workbenchId: device.workbenchId })).rejects.toThrow("retired");

      const scope = { accountId, workbenchId: device.workbenchId, operationId: operation.operationId };
      const acknowledgement = (input: object) =>
        request(manager, servicePath, relayToken, "POST", { ...input, result: "purged", writeBarrier: true });
      expect((await acknowledgement({ ...scope, operationId: crypto.randomUUID() })).status).toBe(404);
      expect((await acknowledgement(scope)).status).toBe(200);
      await restored.restore("backup-after-completion", await owner.snapshot());
      await restored.restore("old-pending-replay", pending);
      const recovered = await restored.snapshot();
      expect(recovered.deletions?.find((row) => row.accountId === accountId)?.state).toBe("completed");
      expect(recovered.keys.some((row) => row.accountId === accountId)).toBe(false);
    } finally {
      await restored.close();
    }
  } finally {
    await Promise.all([target.close(), owner.close(), manager.close()]);
  }
});

test("restore keeps the latest deletion delivery and honors failure within the same delivery", async () => {
  const owner = fixture.owner();
  const target = createAuthorityFixture(implementation);
  const manager = implementation.createManagerAuthentication(config());
  const restoredManager = implementation.createManagerAuthentication({
    ...config(),
    databaseUrl: target.databaseUrl,
  });
  const restored = target.owner();
  try {
    await target.initialize();
    const accountId = await provisionAccount(owner);
    const device = await connectDevice(owner, accountId, "restored-delivery");
    const path = projectPath(device.workbenchId);
    const operation = await (await request(manager, path, device.token, "POST")).json();
    const job = { accountId, workbenchId: device.workbenchId, operationId: operation.operationId };
    const receipt = async () => (await restored.snapshot()).deletions?.find((row) => row.accountId === accountId);
    const failure = { ...job, result: "needs-attention", delivery: 1 };
    const failed = await request(manager, servicePath, relayToken, "POST", failure);
    expect(failed.status).toBe(200);
    const older = await owner.snapshot();
    await restored.restore("first-delivery-failed", older);
    expect(await receipt()).toMatchObject({ state: "needs-attention", delivery: 1 });

    expect((await request(manager, path, device.token, "POST")).status).toBe(202);
    const retrying = await owner.snapshot();
    await restored.restore("retry-delivery", retrying);
    await restored.restore("older-delivery-replayed", older);
    expect(await (await request(restoredManager, servicePath, relayToken)).json()).toContainEqual({
      ...job,
      delivery: 2,
    });
    await request(restoredManager, servicePath, relayToken, "POST", failure);
    expect(await receipt()).toMatchObject({ state: "deleting", delivery: 2 });

    await request(manager, servicePath, relayToken, "POST", { ...failure, delivery: 2 });
    await restored.restore("second-delivery-failed", await owner.snapshot());
    await restored.restore("second-delivery-before-failure", retrying);
    expect(await receipt()).toMatchObject({ state: "needs-attention", delivery: 2 });
  } finally {
    await Promise.all([restored.close(), restoredManager.close(), target.close(), owner.close(), manager.close()]);
  }
});
