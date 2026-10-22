import { strict as assert } from "node:assert";
import { createAuthenticationFixture } from "../src/manager-authentication.fixture";

export const smokeFeatures = async (input: {
  databaseUrl: string;
  accountId: string;
  origin: string;
  ca: string;
  device: { token: string; workbenchId: string };
}) => {
  const email = `${crypto.randomUUID()}@fixture.test`;
  const fixture = createAuthenticationFixture(input.databaseUrl);
  try {
    await fixture.login(input.accountId, email);
  } finally {
    await fixture.close();
  }
  const command = async (action: string, address = email) => {
    const child = Bun.spawn(
      [
        process.execPath,
        new URL("./account-feature.js", import.meta.url).pathname,
        action,
        "--email",
        address,
        "--feature",
        "relay",
      ],
      {
        env: { DATABASE_URL: input.databaseUrl },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [status, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    return { status, output, error };
  };
  const request = (path: string, body?: unknown) =>
    fetch(`${input.origin}${path}`, {
      method: body ? "POST" : "GET",
      headers: { authorization: `Bearer ${input.device.token}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      tls: { ca: input.ca },
    });
  const workbench = `/v1/workbenches/${input.device.workbenchId}`;
  assert.equal((await command("revoke")).status, 0);
  assert.deepEqual(await (await request("/v1/account")).json(), { features: { relay: false } });
  assert.deepEqual(await (await request("/v1/workbenches")).json(), []);
  assert.equal((await request(workbench, {})).status, 403);
  assert.equal((await request(`${workbench}/keys`)).status, 404);
  assert.equal((await request("/v1/environment-access", { workbenchId: input.device.workbenchId })).status, 401);
  assert.equal((await request("/v1/devices")).status, 200);
  const grant = await command("grant");
  assert.equal(grant.status, 0, grant.error);
  assert.deepEqual(JSON.parse(grant.output), { accountId: input.accountId, feature: "relay", enabled: true });
  assert.equal((await request(workbench, {})).status, 200);
  assert.equal((await request(`${workbench}/keys`)).status, 200);
  const unknown = await command("grant", "unknown@fixture.test");
  assert.equal(unknown.status, 1);
  assert.ok(unknown.error.includes("verified Google email"));
  console.log("Built operator command grants and revokes early access; manager gates projects, keys and renewal");
};
