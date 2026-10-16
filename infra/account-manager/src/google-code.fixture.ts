import { strict as assert } from "node:assert";
import { createGoogleFixture } from "./google-identity.fixture";

export const createGoogleCodeFixture = async () => {
  const google = await createGoogleFixture();
  const config = {
    clientId: google.clientId,
    clientSecret: `fixture-client-${crypto.randomUUID()}`,
    redirectUri: "https://manager.example.test/google/callback",
    exchangeTimeoutMs: 1000,
  };
  const codes = new Map<
    string,
    { nonce: string; challenge: string; subject: string; claims: Record<string, unknown> }
  >();
  const issuedTokens: string[] = [];
  let tokenRequests = 0;
  let redirectRequests = 0;
  let response: Response | undefined;
  let tokenResponse: Response | undefined;
  let beforeExchange = async () => {};
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/redirect-target") {
        redirectRequests++;
        return new Response("Unexpected redirected secret request", { status: 400 });
      }
      if (request.method === "GET" && url.pathname === "/authorize") {
        const input = url.searchParams;
        const state = input.get("state");
        const nonce = input.get("nonce");
        const challenge = input.get("code_challenge");
        const subject = request.headers.get("x-fixture-google-subject");
        if (
          !state ||
          !nonce ||
          !challenge ||
          !subject ||
          input.get("client_id") !== config.clientId ||
          input.get("redirect_uri") !== config.redirectUri ||
          input.get("response_type") !== "code" ||
          input.get("scope") !== "openid" ||
          input.get("code_challenge_method") !== "S256" ||
          input.has("client_secret") ||
          input.has("access_type")
        )
          return new Response("Invalid fixture authorization", { status: 400 });
        const code = `fixture-code-${crypto.randomUUID()}`;
        const claims = JSON.parse(request.headers.get("x-fixture-google-claims") ?? "{}");
        codes.set(code, { nonce, challenge, subject, claims });
        const callback = new URL(config.redirectUri);
        callback.searchParams.set("code", code);
        callback.searchParams.set("state", state);
        return Response.redirect(callback, 302);
      }
      if (request.method === "POST" && url.pathname === "/token") {
        tokenRequests++;
        const input = await request.formData();
        const code = String(input.get("code"));
        const pending = codes.get(code);
        const challenge = new Bun.CryptoHasher("sha256").update(String(input.get("code_verifier"))).digest("base64url");
        if (
          !pending ||
          challenge !== pending.challenge ||
          input.get("client_id") !== config.clientId ||
          input.get("client_secret") !== config.clientSecret ||
          input.get("redirect_uri") !== config.redirectUri ||
          input.get("grant_type") !== "authorization_code"
        )
          return Response.json({ error: "invalid_grant" }, { status: 400 });
        codes.delete(code);
        await beforeExchange();
        const configured = response;
        response = undefined;
        if (configured) return configured;
        const idToken = await google.sign({ sub: pending.subject, nonce: pending.nonce, ...pending.claims });
        const accessToken = `unused-access-${crypto.randomUUID()}`;
        const refreshToken = `unused-refresh-${crypto.randomUUID()}`;
        issuedTokens.push(idToken, accessToken, refreshToken);
        return Response.json({ id_token: idToken, access_token: accessToken, refresh_token: refreshToken });
      }
      return new Response("Not found", { status: 404 });
    },
  });
  return {
    config,
    issuedTokens,
    tokenRequests: () => tokenRequests,
    tokenResponse: () => tokenResponse,
    redirectRequests: () => redirectRequests,
    redirectTarget: new URL("/redirect-target", server.url).href,
    respondWith(value: Response) {
      response = value;
    },
    onExchange(effect: () => Promise<void>) {
      beforeExchange = effect;
    },
    reset() {
      codes.clear();
      issuedTokens.length = 0;
      tokenRequests = 0;
      redirectRequests = 0;
      response = undefined;
      tokenResponse = undefined;
      beforeExchange = async () => {};
    },
    transport: async (url: string, options: RequestInit) => {
      if (url === "https://oauth2.googleapis.com/token") {
        tokenResponse = await fetch(new URL("/token", server.url), options);
        return tokenResponse;
      }
      return google.transport(url, options);
    },
    async authorize(authorizationUrl: string, subject: string, claims: Record<string, unknown> = {}) {
      const original = new URL(authorizationUrl);
      assert.equal(original.origin + original.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
      const target = new URL("/authorize", server.url);
      target.search = original.search;
      const response = await fetch(target, {
        redirect: "manual",
        headers: { "x-fixture-google-subject": subject, "x-fixture-google-claims": JSON.stringify(claims) },
      });
      assert.equal(response.status, 302);
      const callback = new URL(response.headers.get("location")!);
      assert.equal(callback.origin + callback.pathname, config.redirectUri);
      return { code: callback.searchParams.get("code")!, state: callback.searchParams.get("state")! };
    },
    close: () => Promise.all([google.close(), server.stop(true)]),
  };
};
