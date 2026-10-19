import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("browser Google sign-in returns a single-use native code only to a valid loopback callback", async () => {
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
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
    const session = await authentication.login(crypto.randomUUID());
    const callback = await get(`/v1/native-callback?${params}`, session.headers);
    expect(callback.status).toBe(302);
    const local = new URL(callback.headers.get("location")!);
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
    await authentication.close();
  }
});
