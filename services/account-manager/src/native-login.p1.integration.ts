import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture } from "./authority.fixture";
import * as implementation from "./index";
import { authenticationConfig, createAuthenticationFixture } from "./manager-authentication.fixture";
import { createOAuthCodeFixture, oauthBrowserCookie } from "./oauth-code.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("browser Google sign-in approves one native callback for the completed session and loopback request", async () => {
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const oauth = await createOAuthCodeFixture();
  const handler = implementation.createManagerHandler(authentication.auth, authentication.config.origin);
  const params = new URLSearchParams({
    callback: "http://127.0.0.1:54321/callback",
    state: "owned-native-state-012345678901234567890",
  });
  const get = (path: string, headers?: HeadersInit) =>
    handler(new Request(`${authentication.config.origin}${path}`, { headers }));
  try {
    const login = await get(`/v1/native-login?${params}`);
    expect(login.status).toBe(302);
    const provider = new URL(login.headers.get("location")!);
    expect(provider.origin).toBe("https://accounts.google.com");
    expect(provider.searchParams.get("redirect_uri")).toBe(`${authentication.config.origin}/api/auth/callback/google`);
    expect(login.headers.getSetCookie().length).toBeGreaterThan(0);
    for (const callback of [
      "https://untrusted.test/callback",
      "http://localhost:54321/callback",
      "http://127.0.0.1:54321/other",
      "http://127.0.0.1:54321/callback?leak=1",
    ]) {
      expect(
        (await get(`/v1/native-login?${new URLSearchParams({ callback, state: params.get("state")! })}`)).status,
      ).toBe(401);
    }
    expect((await get(`/v1/native-callback?${params}`)).status).toBe(401);
    const providerCallback = await oauth.complete("google", provider);
    const completed = await get(providerCallback.pathname + providerCallback.search, {
      cookie: oauthBrowserCookie(login),
    });
    const approved = new URL(completed.headers.get("location")!);
    expect(approved.pathname).toBe("/v1/native-callback");
    const browser = { cookie: oauthBrowserCookie(completed) };
    const path = approved.pathname + approved.search;
    const otherSession = await authentication.login(crypto.randomUUID());
    expect((await get(path, otherSession.headers)).status).toBe(401);
    for (const [key, value] of [
      ["callback", "http://127.0.0.1:54322/callback"],
      ["state", "other-native-state-012345678901234567890"],
    ]) {
      const changed = new URL(approved);
      changed.searchParams.set(key, value);
      expect((await get(changed.pathname + changed.search, browser)).status).toBe(401);
    }
    const attempts = await Promise.all([get(path, browser), get(path, browser)]);
    expect(attempts.map(({ status }) => status).sort()).toEqual([302, 401]);
    const local = new URL(attempts.find(({ status }) => status === 302)!.headers.get("location")!);
    expect(local.origin).toBe("http://127.0.0.1:54321");
    expect(local.searchParams.get("state")).toBe(params.get("state"));
    const exchange = () =>
      handler(
        new Request(`${authentication.config.origin}/api/auth/one-time-token/verify`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: authentication.config.origin },
          body: JSON.stringify({ token: local.searchParams.get("code") }),
        }),
      );
    const verified = await exchange();
    expect(verified.status).toBe(200);
    const body = (await verified.json()) as { session: { token: string } };
    expect((await get("/api/auth/get-session", { authorization: `Bearer ${body.session.token}` })).status).toBe(200);
    expect((await exchange()).status).toBe(400);
  } finally {
    oauth.close();
    await authentication.close();
  }
});

test("an account manager under a path signs in after the proxy removes the path", async () => {
  const origin = "https://shared.fixture.test/accounts";
  const authentication = createAuthenticationFixture(fixture.databaseUrl, {
    origin,
    audience: "https://shared.fixture.test/relay",
  });
  const oauth = await createOAuthCodeFixture();
  const handler = implementation.createManagerHandler(authentication.auth, origin);
  // The proxy forwards https://shared.fixture.test/accounts/<path> to the manager as /<path>.
  const get = (path: string, headers?: HeadersInit) =>
    handler(new Request(`https://shared.fixture.test${path}`, { headers }));
  const params = new URLSearchParams({
    callback: "http://127.0.0.1:54321/callback",
    state: "owned-native-state-012345678901234567890",
  });
  try {
    const login = await get(`/v1/native-login?${params}`);
    expect(login.status).toBe(302);
    const provider = new URL(login.headers.get("location")!);
    expect(provider.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/callback/google`);
    const providerCallback = await oauth.complete("google", provider);
    const completed = await get(providerCallback.pathname.slice("/accounts".length) + providerCallback.search, {
      cookie: oauthBrowserCookie(login),
    });
    const approved = new URL(completed.headers.get("location")!);
    expect(approved.pathname).toBe("/accounts/v1/native-callback");
    const callback = await get(approved.pathname.slice("/accounts".length) + approved.search, {
      cookie: oauthBrowserCookie(completed),
    });
    expect(callback.status).toBe(302);
    const code = new URL(callback.headers.get("location")!).searchParams.get("code");
    const verified = await handler(
      new Request("https://shared.fixture.test/api/auth/one-time-token/verify", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://shared.fixture.test" },
        body: JSON.stringify({ token: code }),
      }),
    );
    expect(verified.status).toBe(200);
  } finally {
    oauth.close();
    await authentication.close();
  }
});

test("web OAuth sign-in ignores caller-supplied native approval context", async () => {
  const config = authenticationConfig(fixture.databaseUrl);
  const { origin } = config;
  const auth = implementation.createManagerAuthentication(config);
  const oauth = await createOAuthCodeFixture();
  const handler = implementation.createManagerHandler(auth, origin);
  const callbackURL = new URL("/v1/native-callback", origin);
  callbackURL.search = new URLSearchParams({
    provider: "google",
    callback: "http://127.0.0.1:54321/callback",
    state: "owned-web-state-012345678901234567890",
  }).toString();
  try {
    const signIn = await handler(
      new Request(`${origin}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          provider: "google",
          callbackURL: callbackURL.href,
          disableRedirect: true,
          additionalData: { nativeLogin: true, serverContext: { nativeLogin: true } },
        }),
      }),
    );
    expect(signIn.status).toBe(200);
    const { url } = (await signIn.json()) as { url: string };
    const callback = await oauth.complete("google", new URL(url), {
      claims: { sub: "ordinary-web-sign-in", email: "web@fixture.test" },
    });
    const completed = await handler(new Request(callback, { headers: { cookie: oauthBrowserCookie(signIn) } }));
    expect(completed.status).toBe(302);
    expect(completed.headers.get("location")).toBe(callbackURL.href);
    const browser = { cookie: oauthBrowserCookie(completed) };
    const session = await handler(new Request(`${origin}/api/auth/get-session`, { headers: browser }));
    expect(await session.json()).toMatchObject({ user: { email: "web@fixture.test" } });
    const rejected = await handler(new Request(callbackURL, { headers: browser }));
    expect(rejected.status).toBe(401);
    expect(rejected.headers.get("location")).toBeNull();
  } finally {
    oauth.close();
    await auth.close();
  }
});
