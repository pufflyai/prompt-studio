import { exportJWK, generateKeyPair, SignJWT } from "jose";

export const createGoogleFixture = async () => {
  const pairs = await Promise.all([generateKeyPair("RS256"), generateKeyPair("RS256")]);
  const keys = await Promise.all(
    pairs.map(async (pair, index) => ({ ...(await exportJWK(pair.publicKey)), kid: `key-${index}`, alg: "RS256" })),
  );
  let requests = 0;
  let status = 200;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => {
      requests++;
      return Response.json({ keys }, { status });
    },
  });
  const transport = (url: string, options: RequestInit) => {
    if (url !== "https://www.googleapis.com/oauth2/v3/certs") throw new Error("Untrusted key source");
    return fetch(server.url, options);
  };
  return {
    clientId: "manager.apps.googleusercontent.com",
    nonce: "pending-login-nonce",
    subject: "stable-google-subject",
    transport,
    requests: () => requests,
    failRequests: () => {
      status = 503;
    },
    async sign(claims: Record<string, unknown> = {}, key = 0, header: Record<string, string> = {}) {
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({
        iss: "https://accounts.google.com",
        sub: "stable-google-subject",
        aud: "manager.apps.googleusercontent.com",
        nonce: "pending-login-nonce",
        iat: now,
        exp: now + 60,
        ...claims,
      })
        .setProtectedHeader({ alg: "RS256", kid: `key-${key}`, ...header })
        .sign(pairs[key].privateKey);
    },
    close: () => server.stop(true),
  };
};
