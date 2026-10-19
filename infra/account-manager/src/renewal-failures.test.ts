import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { createServiceTelemetry } from "pstdio-service-telemetry";
import { connectDevice, createAuthorityFixture, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("renewal distinguishes unavailable storage and signing from invalid credentials without leaking secrets", async () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const sql = new SQL(fixture.databaseUrl);
  const captures: string[] = [];
  const receiver = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      captures.push(await request.text());
      return new Response(null, { status: 403 });
    },
  });
  const telemetry = createServiceTelemetry(
    { SERVER_TELEMETRY_ENABLED: "1", TELEMETRY_ENVIRONMENT: "test", TELEMETRY_RELEASE: "owned-fixture" },
    "manager",
    { endpoint: receiver.url.href },
  );
  const events: unknown[] = [];
  const handler = implementation.createManagerHandler(
    authentication.auth,
    authentication.config.origin,
    (event) => events.push(event),
    telemetry.report,
  );
  const request = (token: string) =>
    handler(
      new Request(`${authentication.config.origin}/v1/environment-access`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ workbenchId: "workbench" }),
      }),
    );
  try {
    const accountId = await provisionAccount(manager);
    const grant = await connectDevice(manager, accountId);
    expect((await request("invalid-secret")).status).toBe(401);
    expect(events).toEqual([]);
    await sql`ALTER TABLE auth_jwks RENAME TO unavailable_jwks`;
    const signing = await request(grant.token);
    expect(signing.status).toBe(503);
    expect(await signing.text()).not.toContain(grant.token);
    expect(events).toEqual([{ event: "environment_access.failed", category: "signing" }]);
    await sql`ALTER TABLE unavailable_jwks RENAME TO auth_jwks`;
    expect((await request(grant.token)).status).toBe(200);
    const login = await authentication.login(accountId);
    await sql`ALTER TABLE auth_sessions RENAME TO unavailable_session`;
    try {
      const failure = await handler(
        new Request(`${authentication.config.origin}/api/auth/get-session`, { headers: login.headers }),
      );
      expect(failure.status).toBe(503);
    } finally {
      await sql`ALTER TABLE unavailable_session RENAME TO auth_sessions`;
    }
    await authentication.auth.close();
    const storage = await request(grant.token);
    expect(storage.status).toBe(503);
    expect(storage.headers.get("www-authenticate")).toBeNull();
    expect(events).toContainEqual({ event: "environment_access.failed", category: "database" });
    for (let attempt = 0; attempt < 100 && telemetry.counts().failed !== 3; attempt++) await Bun.sleep(10);
    expect(telemetry.counts().failed).toBe(3);
    expect(captures.map((raw) => JSON.parse(raw).properties.failure)).toEqual([
      "renewal_signing_failed",
      "request_exception",
      "renewal_database_failed",
    ]);
    expect((await handler(new Request(`${authentication.config.origin}/health`))).status).toBe(200);
    const diagnostics = JSON.stringify({ events, captures });
    for (const secret of [grant.token, fixture.databaseUrl, authentication.config.secret, "invalid-secret"])
      expect(diagnostics).not.toContain(secret);
  } finally {
    telemetry.close();
    await receiver.stop(true);
    await Promise.all([sql.close(), manager.close(), authentication.close()]);
  }
});
