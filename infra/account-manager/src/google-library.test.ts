import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import { createGoogleProviderFixture } from "./google-provider.fixture";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("Better Auth verifies Google tokens, keeps provider identity across email changes and owns logout", async () => {
  const manager = fixture.owner();
  const config = authenticationConfig(fixture.databaseUrl);
  const auth = implementation.createManagerAuthentication(config);
  const google = await createGoogleProviderFixture(config.googleClientId);
  const login = (token: string, nonce = "login-attempt") =>
    auth.handler(
      new Request(`${config.origin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: config.origin },
        body: JSON.stringify({ provider: "google", idToken: { token, nonce } }),
      }),
    );
  try {
    const accountId = await provisionAccount(manager);
    const response = await login(await google.token(accountId));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string } };
    const changed = await login(await google.token(accountId, { email: "new-email@fixture.test" }));
    expect(changed.status).toBe(200);
    expect(((await changed.json()) as { user: { id: string } }).user.id).toBe(body.user.id);
    const cookie = changed.headers
      .getSetCookie()
      .filter((value) => value.includes("session_token="))
      .map((value) => value.split(";")[0])
      .join("; ");
    const access = auth.forSession(new Headers({ cookie }), accountId);
    const { accountId: _, ...intent } = registration(accountId);
    expect((await access.register(intent)).accountId).toBe(accountId);
    for (const overrides of [{ aud: "other-client" }, { iss: "https://another-issuer.test" }, { exp: 1 }])
      expect((await login(await google.token(accountId, overrides))).status).toBe(401);
    expect((await login(await google.token(accountId), "another-attempt")).status).toBe(401);
    expect((await login("invalid-provider-token")).status).toBe(401);
    const genericToken = await auth.handler(new Request(`${config.origin}/api/auth/token`, { headers: { cookie } }));
    expect(genericToken.status).toBe(404);
    const signOut = await auth.handler(
      new Request(`${config.origin}/api/auth/sign-out`, {
        method: "POST",
        headers: { cookie, origin: config.origin },
      }),
    );
    expect(signOut.status).toBe(200);
    await expect(access.environments()).rejects.toThrow();
  } finally {
    google.close();
    await Promise.all([auth.close(), manager.close()]);
  }
});
