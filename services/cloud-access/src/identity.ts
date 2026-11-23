import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import { type AccessConfig, AccessError, instanceSchema } from "./config";

export function createGoogleVerifier(
  config: Pick<AccessConfig, "audience" | "humanAudience">,
  key: JWTVerifyGetKey = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
) {
  return async (request: Request) => {
    const header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer ") || header.length > 16384)
      throw new AccessError(401, "Google authentication required.");
    try {
      const { payload } = await jwtVerify(header.slice(7), key, {
        algorithms: ["RS256"],
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: [config.audience, config.humanAudience],
        requiredClaims: ["sub", "iat", "exp", "aud"],
        maxTokenAge: "2h",
      });
      // A single audience prevents a token for one entry point from crossing into the other.
      if (typeof payload.aud !== "string" || !payload.sub || !payload.exp) throw new Error("Invalid claims.");
      const human = payload.aud === config.humanAudience;
      if (human && payload.email_verified !== true) throw new Error("Unverified account.");
      const google = payload.google as { compute_engine?: unknown } | undefined;
      const instance = google?.compute_engine ? instanceSchema.strip().parse(google.compute_engine) : undefined;
      return { subject: payload.sub, human, expiresAt: payload.exp * 1000, instance };
    } catch {
      throw new AccessError(401, "Google identity is invalid or expired.");
    }
  };
}
export type VerifiedIdentity = Awaited<ReturnType<ReturnType<typeof createGoogleVerifier>>>;
