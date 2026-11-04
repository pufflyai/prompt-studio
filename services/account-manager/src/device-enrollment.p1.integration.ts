import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { verification } from "./auth-schema";
import { connectDevice, createAuthorityFixture, deviceProfile, provisionAccount } from "./authority.fixture";
import { createCredential, digestCredential } from "./credential";
import { connectManager } from "./database";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("a sponsored device enrolls once with its own durable credential and receives only its owner's keys", async () => {
  const owner = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const handler = implementation.createManagerHandler(authentication.auth, authentication.config.origin);
  const call = (token: string, path: string, body?: unknown) =>
    handler(
      new Request(`${authentication.config.origin}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  try {
    const accountId = await provisionAccount(owner);
    const laptop = await connectDevice(owner, accountId);
    const stranger = await connectDevice(owner, await provisionAccount(owner), "foreign-workbench");
    const target = deviceProfile();
    const issued = await call(laptop.token, "/v1/devices/enrollment", target);
    expect(issued.status).toBe(201);
    const grant = (await issued.json()) as { grant: string; expiresAt: string };
    expect(Date.parse(grant.expiresAt)).toBeGreaterThan(Date.now());
    const credential = createCredential();
    const consume = () =>
      call(grant.grant, "/v1/devices/enrollment/consume", { deviceId: target.deviceId, token: credential });
    const results = await Promise.all([consume(), consume()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 401]);
    const accepted = await results.find((r) => r.status === 201)!.json();
    expect(accepted).toMatchObject({
      accountId,
      deviceId: target.deviceId,
      relayOrigin: authentication.config.audience,
    });
    expect(JSON.stringify(accepted)).not.toContain(credential);
    const enrolled = await call(credential, "/v1/devices");
    expect(enrolled.status).toBe(200);
    expect(await enrolled.json()).toMatchObject({ accountId, deviceId: target.deviceId });
    const ownKeys = await call(credential, `/v1/workbenches/${laptop.workbenchId}/keys`);
    expect(ownKeys.status).toBe(200);
    expect(await ownKeys.json()).toEqual(
      await (await call(laptop.token, `/v1/workbenches/${laptop.workbenchId}/keys`)).json(),
    );
    expect((await call(credential, `/v1/workbenches/${stranger.workbenchId}/keys`)).status).toBe(404);
    expect((await call(laptop.token, "/v1/devices/enrollment", target)).status).toBe(401);
    expect((await consume()).status).toBe(401);
  } finally {
    await Promise.all([owner.close(), authentication.close()]);
  }
});

test("enrollment rejects expired, mismatched, removed and reissued sponsor grants and accounts without Cloud access", async () => {
  const owner = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const db = connectManager(fixture.databaseUrl);
  const handler = implementation.createManagerHandler(authentication.auth, authentication.config.origin);
  const call = (token: string, path: string, body: unknown) =>
    handler(
      new Request(`${authentication.config.origin}${path}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  try {
    const accountId = await provisionAccount(owner);
    const laptop = await connectDevice(owner, accountId);
    const target = deviceProfile();
    const issue = async () => {
      const response = await call(laptop.token, "/v1/devices/enrollment", target);
      expect(response.status).toBe(201);
      return (await response.json()) as { grant: string };
    };
    const consume = (grant: string, deviceId = target.deviceId) =>
      call(grant, "/v1/devices/enrollment/consume", { deviceId, token: createCredential() });
    const mismatch = await issue();
    expect((await consume(mismatch.grant, crypto.randomUUID())).status).toBe(401);
    const expired = await issue();
    await db.db
      .update(verification)
      .set({ expiresAt: new Date(0) })
      .where(eq(verification.id, `cloud-enrollment:${digestCredential(expired.grant)}`));
    expect((await consume(expired.grant)).status).toBe(401);
    const removed = await issue();
    await owner.removeDevice({ accountId, deviceId: laptop.deviceId });
    expect((await consume(removed.grant)).status).toBe(401);
    const replacement = await owner.registerDevice({ accountId, ...deviceProfile(laptop.deviceId) });
    expect((await consume(removed.grant)).status).toBe(401);
    const beforeRevoke = (await (await call(replacement.token, "/v1/devices/enrollment", target)).json()) as {
      grant: string;
    };
    await owner.setFeature({ accountId, feature: "relay", enabled: false });
    expect((await consume(beforeRevoke.grant)).status).toBe(403);
    const deniedAccount = await provisionAccount(owner, false);
    const denied = await owner.registerDevice({ accountId: deniedAccount, ...deviceProfile() });
    expect((await call(denied.token, "/v1/devices/enrollment", deviceProfile())).status).toBe(403);
  } finally {
    await Promise.all([owner.close(), authentication.close(), db.close()]);
  }
});

test("a cloud runtime recovers a committed enrollment after response loss and preserves its identity across restart", async () => {
  const { resolve } = await import("node:path");
  const { createOwnedTls } = await import("./owned-tls.fixture");
  const tls = await createOwnedTls();
  const owner = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  let consumed = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    tls: { cert: Bun.file(tls.cert), key: Bun.file(tls.key) },
    async fetch(request) {
      const handler = implementation.createManagerHandler(authentication.auth, server.url.origin);
      const response = await handler(request);
      if (new URL(request.url).pathname === "/v1/devices/enrollment/consume" && response.status === 201) {
        consumed++;
        return new Response(null, { status: 503 });
      }
      return response;
    },
  });
  try {
    const accountId = await provisionAccount(owner);
    const laptop = await owner.registerDevice({ accountId, ...deviceProfile() });
    const target = deviceProfile();
    const grant = await authentication.auth.enrollment.issue(laptop.token, target);
    const child = Bun.spawn(
      [
        process.execPath,
        resolve(
          import.meta.dir,
          "../../../packages/pstdio-api/src/services/account/cloud-bootstrap.integration.fixture.ts",
        ),
      ],
      {
        env: {
          ...process.env,
          NODE_EXTRA_CA_CERTS: tls.cert,
          OWNER_TEST_CLOUD_ENVELOPE: JSON.stringify({
            ...grant,
            accountId,
            deviceId: target.deviceId,
            managerOrigin: server.url.origin,
            relayOrigin: authentication.config.audience,
          }),
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const output = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
    const status = await child.exited;
    if (status) console.error(output.join("\n"));
    expect(status).toBe(0);
    expect(output.join("\n")).toContain("CLOUD_BOOTSTRAP_RECOVERY_OK");
    expect(consumed).toBe(1);
  } finally {
    await server.stop(true);
    await Promise.all([owner.close(), authentication.close(), tls.close()]);
  }
});
