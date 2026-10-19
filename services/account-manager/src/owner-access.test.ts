import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { user } from "./auth-schema";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("library sessions map the stable Google subject to product permissions without using email", async () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  try {
    const accountId = await provisionAccount(manager);
    const login = await authentication.login(accountId);
    const access = authentication.auth.forSession(login.headers, accountId);
    const intent = registration(accountId);
    const { accountId: _, ...ownerIntent } = intent;
    const grant = await access.register(ownerIntent);
    expect(grant.accountId).toBe(accountId);
    await authentication.connection.db
      .update(user)
      .set({ email: "changed@fixture.test" })
      .where(eq(user.id, login.user.id));
    expect((await access.environments()).map((entry) => entry.id)).toContain(grant.id);
    const other = await authentication.login("different-google-subject", login.user.email);
    await expect(authentication.auth.forSession(other.headers, accountId).environments()).rejects.toThrow();
    await expect(access.register({ ...ownerIntent, accountId: "spoofed" } as typeof ownerIntent)).rejects.toThrow();
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});

test("logout invalidates library session management while issued environment access keeps its expiry", async () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  try {
    const accountId = await provisionAccount(manager);
    const login = await authentication.login(accountId);
    const access = authentication.auth.forSession(login.headers, accountId);
    const { accountId: _, ...intent } = registration(accountId);
    const grant = await access.register(intent);
    const issued = await authentication.auth.renew(grant.token!, grant.workbenchId);
    const headers = new Headers(login.headers);
    headers.set("origin", authentication.config.origin);
    const response = await authentication.auth.handler(
      new Request(`${authentication.config.origin}/api/auth/sign-out`, {
        method: "POST",
        headers,
      }),
    );
    expect(response.ok).toBe(true);
    await expect(access.environments()).rejects.toThrow();
    await expect(access.register({ ...intent, requestId: "after-logout" })).rejects.toThrow();
    const verify = implementation.createEnvironmentAccessVerifier({
      issuer: authentication.config.origin,
      audience: authentication.config.audience,
      jwks: await authentication.auth.jwks(),
    });
    expect(await verify(issued.token)).toMatchObject({ accountId, workbenchId: intent.workbenchId });
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});

test("restore removes library sessions and renewal grants while retaining unexpired verification trust", async () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  try {
    const accountId = await provisionAccount(manager);
    const login = await authentication.login(accountId);
    const grant = await manager.register(registration(accountId));
    const issued = await authentication.auth.renew(grant.token!, grant.workbenchId);
    const verify = implementation.createEnvironmentAccessVerifier({
      issuer: authentication.config.origin,
      audience: authentication.config.audience,
      jwks: await authentication.auth.jwks(),
    });
    await manager.restore("auth-restore", await manager.snapshot());
    await expect(authentication.auth.forSession(login.headers, accountId).environments()).rejects.toThrow();
    await expect(authentication.auth.renew(grant.token!, grant.workbenchId)).rejects.toThrow();
    expect(await verify(issued.token)).toMatchObject({ accountId });
    await expect(
      manager.provision({
        requestId: "takeover",
        accountId,
        owner: { issuer: "https://accounts.google.com", subject: "another-owner" },
      }),
    ).rejects.toThrow();
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});
