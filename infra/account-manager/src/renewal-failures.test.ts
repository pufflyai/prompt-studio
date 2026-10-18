import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("renewal distinguishes unavailable storage and signing from invalid credentials without leaking secrets", async () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const sql = new SQL(fixture.databaseUrl);
  const events: unknown[] = [];
  const handler = implementation.createManagerHandler(authentication.auth, authentication.config.origin, (event) =>
    events.push(event),
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
    const grant = await manager.register(registration(accountId));
    expect((await request("invalid-secret")).status).toBe(401);
    expect(events).toEqual([]);
    await sql`ALTER TABLE auth_jwks RENAME TO unavailable_jwks`;
    const signing = await request(grant.token!);
    expect(signing.status).toBe(503);
    expect(await signing.text()).not.toContain(grant.token!);
    expect(events).toEqual([{ event: "environment_access.failed", category: "signing" }]);
    await sql`ALTER TABLE unavailable_jwks RENAME TO auth_jwks`;
    await authentication.auth.close();
    const storage = await request(grant.token!);
    expect(storage.status).toBe(503);
    expect(storage.headers.get("www-authenticate")).toBeNull();
    expect(events).toContainEqual({ event: "environment_access.failed", category: "database" });
    const diagnostics = JSON.stringify(events);
    for (const secret of [grant.token!, fixture.databaseUrl, authentication.config.secret, "invalid-secret"])
      expect(diagnostics).not.toContain(secret);
  } finally {
    await Promise.all([sql.close(), manager.close(), authentication.close()]);
  }
});
