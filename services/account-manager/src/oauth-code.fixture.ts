import { createHash } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { AccountSignInProvider } from "pstdio-sync-contracts";

export const fixtureMicrosoftTenant = "9188040d-6c67-4c5b-b112-36a304b66dad";
export const fixtureMicrosoftClient = {
  clientId: "fcaa0151-ec9d-434a-9d69-79ab5598f122",
  clientSecret: "owned-microsoft-oauth-fixture-only",
};
const microsoft = "https://login.microsoftonline.com";
const googleIssuer = "https://accounts.google.com";

export const oauthBrowserCookie = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

const fixtures = {
  microsoft: {
    authorize: `${microsoft}/common/oauth2/v2.0/authorize`,
    token: `${microsoft}/common/oauth2/v2.0/token`,
    jwks: `${microsoft}/common/discovery/v2.0/keys`,
    ...fixtureMicrosoftClient,
  },
  google: {
    authorize: `${googleIssuer}/o/oauth2/v2/auth`,
    token: "https://oauth2.googleapis.com/token",
    jwks: "https://www.googleapis.com/oauth2/v3/certs",
    clientId: "fixture-google-client",
    clientSecret: "fixture-google-secret",
  },
};

export const createOAuthCodeFixture = async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), alg: "RS256", kid: "owned-fixture-key", use: "sig" };
  const codes = new Map<
    string,
    { provider: AccountSignInProvider; challenge: string; redirect: string; token: string }
  >();
  const original = globalThis.fetch;
  let keyIssuer = `${microsoft}/{tenantid}/v2.0`;
  const clientSecrets = { microsoft: fixtures.microsoft.clientSecret, google: fixtures.google.clientSecret };
  let exchanged = 0;
  globalThis.fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = input instanceof Request ? input.url : String(input);
      for (const [name, fixture] of Object.entries(fixtures)) {
        const provider = name as AccountSignInProvider;
        if (url === fixture.jwks)
          return Response.json({ keys: [{ ...jwk, ...(provider === "microsoft" && { issuer: keyIssuer }) }] });
        if (url !== fixture.token) continue;
        const request = new Request(url, input instanceof Request ? input : init);
        const form = await request.formData();
        const code = String(form.get("code"));
        const issued = codes.get(code);
        codes.delete(code);
        const verifier = String(form.get("code_verifier"));
        if (
          !issued ||
          issued.provider !== provider ||
          !verifier ||
          createHash("sha256").update(verifier).digest("base64url") !== issued.challenge ||
          form.get("redirect_uri") !== issued.redirect ||
          form.get("client_id") !== fixture.clientId ||
          form.get("client_secret") !== clientSecrets[provider]
        )
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        exchanged++;
        return Response.json({ id_token: issued.token, access_token: "owned-fixture-access", token_type: "Bearer" });
      }
      return original(input, init);
    },
    { preconnect: original.preconnect },
  );

  return {
    authorize: { google: fixtures.google.authorize, microsoft: fixtures.microsoft.authorize },
    exchanged: () => exchanged,
    setMicrosoftKeyIssuer: (issuer: string) => {
      keyIssuer = issuer;
    },
    setMicrosoftClientSecret: (secret: string) => {
      clientSecrets.microsoft = secret;
    },
    async complete(
      provider: AccountSignInProvider,
      url: URL,
      options: { deny?: boolean; claims?: Record<string, unknown> } = {},
    ) {
      const fixture = fixtures[provider];
      const query = url.searchParams;
      if (
        url.origin + url.pathname !== fixture.authorize ||
        query.get("client_id") !== fixture.clientId ||
        query.get("code_challenge_method") !== "S256" ||
        !query.get("code_challenge") ||
        !query.get("state") ||
        (provider === "microsoft" && !query.get("nonce"))
      )
        throw new Error("Invalid fixture authorization request");
      const callback = new URL(query.get("redirect_uri")!);
      callback.searchParams.set("state", query.get("state")!);
      if (options.deny) {
        callback.searchParams.set("error", "access_denied");
        callback.searchParams.set("error_description", "provider-only-detail");
        return callback;
      }
      const tenant = options.claims?.tid ?? fixtureMicrosoftTenant;
      const token = await new SignJWT({
        iss: provider === "microsoft" ? `${microsoft}/${tenant}/v2.0` : googleIssuer,
        aud: fixture.clientId,
        sub: "owned-fixture-subject",
        tid: tenant,
        ver: "2.0",
        name: "Fixture owner",
        email: "owner@fixture.test",
        email_verified: provider === "google",
        nonce: query.get("nonce"),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        ...options.claims,
      })
        .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
        .sign(privateKey);
      const code = crypto.randomUUID();
      codes.set(code, {
        provider,
        challenge: query.get("code_challenge")!,
        redirect: callback.origin + callback.pathname,
        token,
      });
      callback.searchParams.set("code", code);
      return callback;
    },
    close() {
      globalThis.fetch = original;
    },
  };
};
