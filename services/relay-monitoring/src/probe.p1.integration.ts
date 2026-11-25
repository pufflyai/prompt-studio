import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTransportFixture, startRelay } from "pstdio-relay/testing";
import { createProbe } from "./probe";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("two monitoring devices verify sealed updates, states, multipart blobs and live delivery without customer data", async () => {
  const context = await fixture.context();
  const relay = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const manager = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: context.managerHandler });
  let budgetAvailable = true;
  const budget = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () =>
      Response.json({
        status: "success",
        data: { result: budgetAvailable ? [{ value: [Date.now() / 1000, "0"] }] : [] },
      }),
  });
  const directory = await mkdtemp(join(tmpdir(), "relay-canary-integration-"));
  const secondId = crypto.randomUUID();
  const second = await context.manager.registerDevice({
    accountId: context.scope.accountId,
    deviceId: secondId,
    name: "Monitoring peer",
    platform: "linux",
  });
  const config = {
    enabled: true as const,
    dedicatedMonitoringAccount: true as const,
    environment: "test" as const,
    managerOrigin: manager.url.href,
    relayOrigin: relay.url.href,
    accountId: context.scope.accountId,
    workbenchId: context.scope.workbenchId,
    checkpointDirectory: directory,
    devices: [
      { deviceId: context.environmentId, credential: context.device.token, renewalGrant: context.device.token },
      { deviceId: secondId, credential: second.token, renewalGrant: second.token },
    ] as [
      { deviceId: string; credential: string; renewalGrant: string },
      { deviceId: string; credential: string; renewalGrant: string },
    ],
    budget: {
      queryOrigin: budget.url.href,
      readToken: "owned-canary-budget-token-32-characters",
      accountAlias: "monitoring" as const,
      maximumBytes: 100 * 1024 ** 2,
    },
  };
  try {
    const probe = await createProbe(config);
    await probe.run(AbortSignal.timeout(15_000));
    const success = () =>
      Object.fromEntries(
        probe.metrics
          .snapshot()
          .filter(({ name }) => name.endsWith("check_success"))
          .map(({ labels, value }) => [labels.check, value]),
      );
    expect(success()).toEqual({ http: 1, access: 1, sync: 1, blobs: 1, live: 1 });
    const first = JSON.parse(await readFile(join(directory, "checkpoint.json"), "utf8"));
    expect(first.lastMultipartAt).toBeGreaterThan(0);
    expect(first.pendingUpdate).toBeUndefined();
    expect(first.pendingBlob).toBeUndefined();
    const restored = await createProbe(config);
    budgetAvailable = false;
    const objects = await fixture.objectKeys();
    await restored.run(AbortSignal.timeout(15_000));
    expect(await fixture.objectKeys()).toEqual(objects);
    expect(
      restored.metrics.snapshot().find(({ name, labels }) => name.endsWith("check_success") && labels.check === "sync")
        ?.value,
    ).toBe(-1);
    expect(JSON.parse(await readFile(join(directory, "checkpoint.json"), "utf8")).documentId).toBe(first.documentId);
    expect(probe.metrics.render()).not.toContain(context.scope.accountId);
    expect(probe.metrics.render()).not.toContain(context.scope.workbenchId);
    config.devices[1].credential = "owned-denied-device-credential";
    await probe.run(AbortSignal.timeout(15_000));
    expect(probe.metrics.snapshot().find(({ name }) => name.endsWith("probe_budget_observation_success"))?.value).toBe(
      0,
    );
  } finally {
    await Promise.all([relay.stop(true), manager.stop(true), budget.stop(true)]);
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
