import { strict as assert } from "node:assert";
import { provisionAccount, registration } from "../src/authority.fixture";
import type * as Authority from "../src/index";

export const smokeEnvironmentAuthority = async (
  implementation: typeof Authority,
  manager: ReturnType<typeof Authority.createAccountManager>,
) => {
  const serviceSecret = `fixture-service-${crypto.randomUUID()}`;
  const accountId = await provisionAccount(manager);
  const intent = registration(accountId);
  const grant = await manager.register(intent);
  assert.ok(grant.token);
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: implementation.createEnvironmentAuthorityHandler(manager, { serviceSecret }),
  });
  const check = async (settings: { serviceSecret?: string; origin?: string } = {}) => {
    const child = Bun.spawn([process.execPath, new URL("./authority-client-smoke.js", import.meta.url).pathname], {
      env: {
        PATH: process.env.PATH,
        AUTHORITY_ORIGIN: settings.origin ?? "https://manager.example.test",
        AUTHORITY_SERVICE_SECRET: settings.serviceSecret ?? serviceSecret,
        AUTHORITY_FIXTURE_URL: server.url.href,
        AUTHORITY_ENVIRONMENT_TOKEN: grant.token!,
        AUTHORITY_WORKBENCH: intent.workbenchId,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [status, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    for (const secret of [grant.token!, serviceSecret]) {
      assert.ok(!output.includes(secret));
      assert.ok(!error.includes(secret));
    }
    return { status, output, error };
  };
  try {
    const allowed = await check();
    assert.equal(allowed.status, 0, allowed.error);
    assert.deepEqual(JSON.parse(allowed.output), {
      identity: { accountId, workbenchId: intent.workbenchId, environmentId: intent.environmentId },
    });
    const unauthenticated = await check({ serviceSecret: "wrong-service-secret" });
    assert.equal(unauthenticated.status, 1);
    assert.equal(unauthenticated.output, "");
    const invalidConfig = await check({ origin: serviceSecret });
    assert.equal(invalidConfig.status, 1);
    assert.equal(invalidConfig.output, "");
    await manager.revoke({ accountId, requestId: "remote-revoke", environmentId: intent.environmentId });
    const denied = await check();
    assert.equal(denied.status, 0, denied.error);
    assert.deepEqual(JSON.parse(denied.output), { identity: null });
    console.log("Built private HTTP authority and separate client without manager database settings passed");
  } finally {
    await server.stop(true);
  }
};
