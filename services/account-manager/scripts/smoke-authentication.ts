import { strict as assert } from "node:assert";
import { createServer } from "node:net";
import { connectDevice } from "../src/authority.fixture";
import type * as Implementation from "../src/index";
import { createOwnedTls } from "../src/owned-tls.fixture";

export const smokeAuthentication = async (
  databaseUrl: string,
  manager: ReturnType<typeof Implementation.createAccountManager>,
  accountId: string,
) => {
  const tls = await createOwnedTls();
  const port = await new Promise<number>((resolve, reject) => {
    const listener = createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      if (!address || typeof address === "string") return reject(new Error("No fixture port"));
      listener.close(() => resolve(address.port));
    });
  });
  const origin = `https://127.0.0.1:${port}`;
  const child = Bun.spawn([process.execPath, new URL("./server.js", import.meta.url).pathname], {
    env: {
      HOME: process.env.HOME,
      DATABASE_URL: databaseUrl,
      MANAGER_ORIGIN: origin,
      RELAY_AUDIENCE: "https://relay.fixture.test",
      BETTER_AUTH_SECRET: "disposable-built-auth-secret-fixture-0123456789",
      GOOGLE_CLIENT_ID: "fixture-client",
      GOOGLE_CLIENT_SECRET: "fixture-secret",
      SESSION_LIFETIME_SECONDS: "120",
      SESSION_UPDATE_AGE_SECONDS: "60",
      ACCESS_LIFETIME_SECONDS: "30",
      MANAGER_TLS_CERT: tls.cert,
      MANAGER_TLS_KEY: tls.key,
      MANAGER_PORT: String(port),
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "inherit",
  });
  try {
    const reader = child.stdout.getReader();
    const ready = await reader.read();
    assert.ok(!ready.done, "Built manager must start");
    reader.releaseLock();
    const ca = await Bun.file(tls.cert).text();
    const grant = await connectDevice(manager, accountId);
    const renew = () =>
      fetch(`${origin}/v1/environment-access`, {
        method: "POST",
        headers: { authorization: `Bearer ${grant.token}`, "content-type": "application/json" },
        body: JSON.stringify({ workbenchId: grant.workbenchId }),
        tls: { ca },
      });
    const response = await renew();
    assert.equal(response.status, 200);
    const issued = (await response.json()) as { token: string };
    const keys = await fetch(`${origin}/api/auth/jwks`, { tls: { ca } });
    assert.equal(keys.status, 200);
    const trust = { issuer: origin, audience: "https://relay.fixture.test", jwks: await keys.json() };
    const verify = () => {
      const result = Bun.spawnSync(
        [process.execPath, new URL("./environment-verifier-smoke.js", import.meta.url).pathname],
        {
          env: {},
          stdin: new TextEncoder().encode(JSON.stringify({ trust, token: issued.token })),
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      assert.equal(result.exitCode, 0, "Verifier-only process needs no manager connection or secret");
      assert.equal(JSON.parse(new TextDecoder().decode(result.stdout)).accountId, accountId);
    };
    verify();
    await manager.removeDevice({ accountId, deviceId: grant.deviceId });
    assert.equal((await renew()).status, 401);
    verify();
    child.kill("SIGTERM");
    assert.equal(await child.exited, 0, "Built manager must drain on shutdown");
    verify();
    console.log("Built Better Auth HTTPS issuance, renewal denial and independent offline verification passed");
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await child.exited;
    await tls.close();
  }
};
