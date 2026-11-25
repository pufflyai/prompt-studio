import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";
import { createOAuthCodeFixture, fixtureMicrosoftClient } from "./oauth-code.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("Microsoft uses the browser code flow and owns only its tenant-scoped account", async () => {
  const config = { ...authenticationConfig(fixture.databaseUrl), microsoft: fixtureMicrosoftClient };
  const auth = implementation.createManagerAuthentication(config);
  const oauth = await createOAuthCodeFixture();
  const handler = implementation.createManagerHandler(auth, config.origin);
  const fetchManager = (url: URL, headers?: HeadersInit) => handler(new Request(url, { headers }));
  try {
    const providers = await fetchManager(new URL("/v1/sign-in-providers", config.origin));
    expect(await providers.json()).toEqual({ microsoft: true });
    const browserLogin = async (
      provider: "google" | "microsoft",
      options?: Parameters<typeof oauth.complete>[2],
      wrongState = false,
    ) => {
      const native = new URL("/v1/native-login", config.origin);
      native.searchParams.set("provider", provider);
      native.searchParams.set("callback", "http://127.0.0.1:54321/callback");
      native.searchParams.set("state", "owned-native-state-012345678901234567890");
      const redirect = await fetchManager(native);
      expect(redirect.status).toBe(302);
      const oauthState = redirect.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
      const callback = await oauth.complete(provider, new URL(redirect.headers.get("location")!), options);
      if (wrongState) callback.searchParams.set("state", "not-the-authorization-state");
      return await fetchManager(callback, { cookie: oauthState });
    };
    const deviceLogin = async (provider: "google" | "microsoft", options?: Parameters<typeof oauth.complete>[2]) => {
      const response = await browserLogin(provider, options);
      const redirect = new URL(response.headers.get("location")!);
      expect(redirect.pathname).toBe("/v1/native-callback");
      const cookie = response.headers
        .getSetCookie()
        .map((item) => item.split(";")[0])
        .join("; ");
      const callback = await fetchManager(redirect, { cookie });
      expect(callback.status).toBe(302);
      const local = new URL(callback.headers.get("location")!);
      expect(`${local.origin}${local.pathname}`).toBe("http://127.0.0.1:54321/callback");
      expect(local.searchParams.get("state")).toBe("owned-native-state-012345678901234567890");
      const code = local.searchParams.get("code");
      expect(code).toBeTruthy();
      const post = (path: string, body: unknown, token?: string) =>
        handler(
          new Request(new URL(path, config.origin), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: config.origin,
              ...(token ? { authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
          }),
        );
      const exchange = () => post("/api/auth/one-time-token/verify", { token: code });
      const session = await exchange();
      expect(session.status).toBe(200);
      const {
        session: { token },
      } = (await session.json()) as { session: { token: string } };
      expect((await exchange()).status).toBe(400);
      const connect = (provider: "google" | "microsoft") =>
        post("/v1/device-login", { ...deviceProfile(), provider }, token);
      expect((await connect(provider === "google" ? "microsoft" : "google")).status).toBe(401);
      const device = await connect(provider);
      expect(device.status).toBe(201);
      return (await device.json()) as { accountId: string };
    };

    const google = await deviceLogin("google");
    const microsoft = await deviceLogin("microsoft");
    expect(google.accountId).not.toBe(microsoft.accountId);
    expect((await deviceLogin("microsoft", { claims: { email: undefined } })).accountId).toBe(microsoft.accountId);
    const other = await deviceLogin("microsoft", { claims: { tid: "b8cf818a-09e1-4b19-95b4-2f416fb0c607" } });
    expect(other.accountId).not.toBe(microsoft.accountId);
    const verified = oauth.exchanged();
    expect(new URL((await browserLogin("microsoft", undefined, true)).headers.get("location")!).pathname).not.toBe(
      "/v1/native-callback",
    );
    expect(oauth.exchanged()).toBe(verified);

    for (const claims of [
      { aud: "wrong-client" },
      { iss: "https://wrong-issuer.test" },
      { exp: 1 },
      { nonce: "wrong-nonce" },
      { tid: "not-a-tenant" },
      { sub: undefined },
    ]) {
      const failed = await browserLogin("microsoft", { claims });
      expect(new URL(failed.headers.get("location")!).pathname).toBe("/v1/native-error");
    }
    oauth.setMicrosoftKeyIssuer("https://login.microsoftonline.com/b8cf818a-09e1-4b19-95b4-2f416fb0c607/v2.0");
    const wrongKey = await browserLogin("microsoft");
    expect(new URL(wrongKey.headers.get("location")!).pathname).toBe("/v1/native-error");

    const denied = await browserLogin("microsoft", { deny: true });
    const local = await fetchManager(new URL(denied.headers.get("location")!));
    const error = new URL(local.headers.get("location")!);
    expect(error.searchParams.get("error")).toBe("provider-denied");
    expect(error.searchParams.has("error_description")).toBe(false);
  } finally {
    oauth.close();
    await auth.close();
  }
});
