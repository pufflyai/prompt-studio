import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("native renewal and session-owned management expose sanitized separate HTTP boundaries", async () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const handler = implementation.createManagerHandler(authentication.auth, `${authentication.config.origin}/`);
  const request = (path: string, body?: unknown, headers?: HeadersInit) =>
    handler(
      new Request(`${authentication.config.origin}${path}`, {
        method: body ? "POST" : "GET",
        headers: { "content-type": "application/json", ...Object.fromEntries(new Headers(headers)) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  try {
    const accountId = await provisionAccount(manager);
    const grant = await manager.register(registration(accountId));
    const issued = await request(
      "/v1/environment-access",
      { workbenchId: grant.workbenchId },
      { authorization: `bEaReR   ${grant.token}` },
    );
    expect(issued.status).toBe(200);
    expect(issued.headers.get("cache-control")).toBe("no-store");
    const access = (await issued.json()) as { token: string };
    const verify = implementation.createEnvironmentAccessVerifier({
      issuer: authentication.config.origin,
      audience: authentication.config.audience,
      jwks: await authentication.auth.jwks(),
    });
    expect(await verify(access.token)).toMatchObject({ accountId, environmentId: grant.environmentId });
    const denied = await request(
      "/v1/environment-access",
      { workbenchId: "another-workbench" },
      { authorization: `Bearer ${grant.token}` },
    );
    expect(denied.status).toBe(401);
    expect(await denied.text()).not.toContain(grant.token!);
    expect(denied.headers.get("www-authenticate")).toBe("Bearer");
    const login = await authentication.login(accountId);
    const path = `/v1/accounts/${encodeURIComponent(accountId)}/environments`;
    expect((await request(path, undefined, login.headers)).status).toBe(200);
    const { accountId: _, ...intent } = registration(accountId);
    expect((await request(path, intent, login.headers)).status).toBe(403);
    const headers = new Headers(login.headers);
    headers.set("origin", authentication.config.origin);
    expect((await request(path, intent, headers)).status).toBe(201);
    expect((await request("/v1/accounts/another-account/environments", undefined, headers)).status).toBe(401);
    expect((await request(path, { ...intent, accountId }, headers)).status).toBe(401);
    const absent = await request("/unknown");
    expect(absent.status).toBe(404);
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});
