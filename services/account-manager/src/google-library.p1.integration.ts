import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, deviceProfile, provisionAccount } from "./authority.fixture";
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
    const headers = new Headers({ cookie, origin: config.origin });
    expect((await auth.loginDevice(headers, deviceProfile())).token).toBeString();
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
    await expect(auth.loginDevice(headers, deviceProfile())).rejects.toThrow();
  } finally {
    google.close();
    await Promise.all([auth.close(), manager.close()]);
  }
});

test("team invitations follow the latest verified Google address and survive address cycling safely", async () => {
  const manager = fixture.owner();
  const config = authenticationConfig(fixture.databaseUrl);
  const auth = implementation.createManagerAuthentication(config);
  const google = await createGoogleProviderFixture(config.googleClientId);
  const handler = implementation.createManagerHandler(auth, config.origin);
  const subject = crypto.randomUUID();
  const firstAddress = `${subject}@fixture.test`;
  const nextAddress = `${subject}-renamed@fixture.test`;
  const firstIssuedAt = Math.floor(Date.now() / 1000) - 10;
  const signIn = async (email: string, offset: number, email_verified = true) => {
    const token = await google.token(subject, { email, email_verified, iat: firstIssuedAt + offset });
    const response = await handler(
      new Request(`${config.origin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { origin: config.origin, "content-type": "application/json" },
        body: JSON.stringify({ provider: "google", idToken: { token, nonce: "login-attempt" } }),
      }),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .filter((value) => value.includes("session_token="))
      .map((value) => value.split(";")[0])
      .join("; ");
    return new Headers({ origin: config.origin, cookie });
  };
  const post = (path: string, body: unknown, headers: Headers) =>
    handler(
      new Request(config.origin + path, {
        method: "POST",
        headers: { ...Object.fromEntries(headers), "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  try {
    const accountId = await provisionAccount(manager);
    const owner = await manager.registerDevice({ accountId, ...deviceProfile() });
    const ownerHeaders = new Headers({ authorization: `Bearer ${owner.token}` });
    const createTeam = async (name: string) => {
      const response = await post("/v1/teams", { name }, ownerHeaders);
      expect(response.status).toBe(201);
      return (await response.json()).accountId as string;
    };
    const invite = async (team: string, email: string) => {
      const response = await post(`/v1/teams/${team}/invitations`, { email }, ownerHeaders);
      expect(response.status).toBe(201);
      const { url } = await response.json();
      return { secret: new URL(url).hash.slice(1) };
    };
    const team = await createTeam("Address changes");
    const original = await invite(team, firstAddress);
    const first = await auth.loginDevice(await signIn(firstAddress, 0), deviceProfile());
    const renamed = await signIn(nextAddress, 1);
    const current = await auth.loginDevice(renamed, deviceProfile());
    expect(current.accountId).toBe(first.accountId);
    const nativeHeaders = new Headers({ authorization: `Bearer ${current.token}` });
    const inspectNative = async (invitation: typeof original) =>
      (await post("/v1/team-invitations/inspect", invitation, nativeHeaders)).json();
    const inspectBrowser = async (invitation: typeof original, headers: Headers) =>
      (await post("/v1/team-invitation/inspect", invitation, headers)).json();

    expect(await inspectNative(original)).toMatchObject({ state: "wrong-identity", signedInEmail: nextAddress });
    expect(await inspectBrowser(original, renamed)).toMatchObject({
      state: "wrong-identity",
      signedInEmail: nextAddress,
    });
    expect((await post("/v1/team-invitations/accept", original, nativeHeaders)).status).toBe(403);
    const updated = await invite(team, nextAddress);
    expect((await post("/v1/team-invitation/accept", updated, renamed)).status).toBe(200);
    expect((await post(`/v1/teams/${team}/members/${first.accountId}/remove`, {}, ownerHeaders)).status).toBe(200);

    const returned = await signIn(firstAddress, 2);
    expect(await inspectBrowser(original, returned)).toMatchObject({ state: "canceled", signedInEmail: firstAddress });
    expect((await post("/v1/team-invitations/accept", original, nativeHeaders)).status).toBe(403);
    const fresh = await invite(team, firstAddress);
    expect(await inspectNative(fresh)).toMatchObject({ state: "pending", signedInEmail: firstAddress });
    expect((await post("/v1/team-invitations/accept", fresh, nativeHeaders)).status).toBe(200);

    const otherTeam = await createTeam("Unverified claims");
    const otherInvite = await invite(otherTeam, firstAddress);
    await signIn(firstAddress, 3, false);
    await signIn(firstAddress, 2);
    expect(await inspectNative(otherInvite)).toEqual({ state: "wrong-identity", teamName: "Unverified claims" });
    expect((await post("/v1/team-invitations/accept", otherInvite, nativeHeaders)).status).toBe(403);
  } finally {
    google.close();
    await Promise.all([auth.close(), manager.close()]);
  }
});
