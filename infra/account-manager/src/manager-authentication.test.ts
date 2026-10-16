import { afterAll, beforeAll, expect, test } from "bun:test";
import { createLocalJWKSet, jwtVerify } from "jose";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("an environment renews scoped library-signed access that remains valid after grant revocation", async () => {
  const manager = fixture.owner();
  const auth = implementation.createManagerAuthentication({
    databaseUrl: fixture.databaseUrl,
    origin: "https://auth.fixture.test",
    audience: "https://relay.fixture.test",
    secret: "disposable-library-secret-fixture-only-0123456789",
    googleClientId: "fixture-google-client",
    googleClientSecret: "fixture-google-secret",
    sessionLifetimeSeconds: 120,
    sessionUpdateAgeSeconds: 60,
    accessLifetimeSeconds: 30,
  });
  try {
    const accountId = await provisionAccount(manager);
    const grant = await manager.register(registration(accountId));
    const access = await auth.renew(grant.token!, grant.workbenchId);
    const keys = createLocalJWKSet(await auth.jwks());
    const verification = { issuer: "https://auth.fixture.test", audience: "https://relay.fixture.test" };
    const { payload } = await jwtVerify(access.token, keys, verification);
    expect(payload).toMatchObject({
      tokenType: "pstdio-environment-access",
      accountId,
      workbenchId: grant.workbenchId,
      environmentId: grant.environmentId,
      sub: grant.environmentId,
    });
    expect(payload.exp! - payload.iat!).toBe(30);
    expect(access.expiresAt).toBe(new Date(payload.exp! * 1000).toISOString());
    await manager.revoke({ requestId: "revoke", accountId, environmentId: grant.environmentId });
    const denied = await auth.renew(grant.token!, grant.workbenchId).catch((error: unknown) => error);
    expect(denied).toBeInstanceOf(Error);
    expect((await jwtVerify(access.token, keys, verification)).payload).toEqual(payload);
  } finally {
    await Promise.all([auth.close(), manager.close()]);
  }
});

test("issuance caps access at grant expiry and expired access cannot authorize", async () => {
  const manager = fixture.owner();
  const auth = implementation.createManagerAuthentication({
    ...authenticationConfig(fixture.databaseUrl),
    accessLifetimeSeconds: 2,
  });
  const standardAuth = implementation.createManagerAuthentication(authenticationConfig(fixture.databaseUrl));
  try {
    const accountId = await provisionAccount(manager);
    const grant = await manager.register(registration(accountId));
    const issued = await auth.renew(grant.token!, grant.workbenchId);
    const verify = implementation.createEnvironmentAccessVerifier({
      issuer: "https://auth.fixture.test",
      audience: "https://relay.fixture.test",
      jwks: await auth.jwks(),
    });
    expect(Date.parse(issued.expiresAt)).toBeLessThanOrEqual(Date.parse(grant.expiresAt));
    expect(await verify(issued.token)).toMatchObject({ accountId });
    await Bun.sleep(2100);
    await expect(verify(issued.token)).rejects.toThrow();
    const short = await manager.register({
      ...registration(accountId),
      expiresAt: new Date((Math.floor(Date.now() / 1000) + 2) * 1000).toISOString(),
    });
    const capped = await standardAuth.renew(short.token!, short.workbenchId);
    expect(capped.expiresAt).toBe(short.expiresAt);
  } finally {
    await Promise.all([auth.close(), standardAuth.close(), manager.close()]);
  }
});
