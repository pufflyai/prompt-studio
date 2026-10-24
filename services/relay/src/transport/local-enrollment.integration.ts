import { afterAll, beforeAll, expect, test } from "bun:test";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("local enrollment gives the device one token for every cloud project of the fixture account", async () => {
  const context = await fixture.context();
  const accountId = "built-network-account";
  try {
    await context.manager.provision({
      requestId: "local-fixture-account",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: "owned-local-fixture" },
    });
    await context.manager.setFeature({ accountId, feature: "relay", enabled: true });
    await context.manager.addWorkbench({ accountId, workbenchId: context.scope.workbenchId });
    const enroll = async () => {
      const child = Bun.spawn(
        [process.execPath, new URL("../../scripts/enroll-local.fixture.ts", import.meta.url).pathname],
        {
          env: { ...process.env, DATABASE_URL: fixture.managerDatabaseUrl },
          stdin: new Blob([
            JSON.stringify({ deviceId: context.environmentId, name: "Local app", workbenchId: "demo-workbench" }),
          ]),
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      const [status, device, errors] = await Promise.all([
        child.exited,
        new Response(child.stdout).json() as Promise<{ accountId: string; deviceId: string; token: string }>,
        new Response(child.stderr).text(),
      ]);
      expect(errors).toBe("");
      expect(status).toBe(0);
      expect(device).toMatchObject({ accountId, deviceId: context.environmentId });
      return device.token;
    };
    const first = await enroll();
    for (const workbenchId of ["demo-workbench", context.scope.workbenchId])
      expect(await context.manager.authorize(first, workbenchId)).not.toBeNull();
    // The launcher enrolls again when the saved token is denied, for example after another device removed this one.
    await context.manager.removeDevice({ accountId, deviceId: context.environmentId });
    const second = await enroll();
    expect(await context.manager.authorize(second, context.scope.workbenchId)).not.toBeNull();
    expect(await context.manager.authorize(first, context.scope.workbenchId)).toBeNull();
  } finally {
    await context.close();
  }
});
