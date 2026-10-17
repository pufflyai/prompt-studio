import { exportJWK, generateKeyPair, SignJWT } from "jose";

export const createGoogleProviderFixture = async (clientId: string) => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const key = { ...(await exportJWK(publicKey)), kid: crypto.randomUUID(), alg: "RS256", use: "sig" };
  const originalFetch = globalThis.fetch;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => Response.json({ keys: [key] }),
  });
  // Route only Google's public-key transport to a real owned HTTP fixture. The library
  // still performs its complete Google signature/issuer/audience/nonce verification.
  globalThis.fetch = Object.assign(
    (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = input instanceof Request ? input.url : String(input);
      return originalFetch(url === "https://www.googleapis.com/oauth2/v3/certs" ? server.url : input, init);
    },
    { preconnect: originalFetch.preconnect },
  );
  return {
    async token(subject: string, overrides: Record<string, unknown> = {}) {
      return new SignJWT({
        iss: "https://accounts.google.com",
        aud: clientId,
        sub: subject,
        email: `${subject}@fixture.test`,
        email_verified: true,
        name: "Fixture owner",
        nonce: "login-attempt",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        ...overrides,
      })
        .setProtectedHeader({ alg: "RS256", kid: key.kid })
        .sign(privateKey);
    },
    close() {
      globalThis.fetch = originalFetch;
      server.stop(true);
    },
  };
};
