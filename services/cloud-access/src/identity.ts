import { createRemoteJWKSet, decodeJwt, type JWTVerifyGetKey, jwtVerify } from "jose";
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
      return { provider: "google" as const, subject: payload.sub, human, expiresAt: payload.exp * 1000, instance };
    } catch {
      throw new AccessError(401, "Google identity is invalid or expired.");
    }
  };
}
export type VerifiedIdentity = {
  provider: "google" | "microsoft";
  subject: string;
  human: boolean;
  expiresAt: number;
  instance?: import("zod").infer<typeof instanceSchema>;
};

export function createIdentityVerifier(
  config: Pick<AccessConfig, "audience" | "humanAudience" | "microsoft">,
  keys?: { google?: JWTVerifyGetKey; microsoft?: JWTVerifyGetKey },
) {
  const google = createGoogleVerifier(config, keys?.google);
  const microsoft = config.microsoft;
  const issuer = microsoft && `https://login.microsoftonline.com/${microsoft.tenantId}/v2.0`;
  const microsoftKey =
    microsoft &&
    (keys?.microsoft ??
      createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${microsoft.tenantId}/discovery/v2.0/keys`)));
  return async (request: Request): Promise<VerifiedIdentity> => {
    const header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer ") || header.length > 16384)
      throw new AccessError(401, "Identity authentication required.");
    try {
      // Unverified issuer selects a fixed verifier only; no token can supply a key URL or policy.
      if (microsoft && microsoftKey && decodeJwt(header.slice(7)).iss === issuer) {
        const { payload } = await jwtVerify(header.slice(7), microsoftKey, {
          algorithms: ["RS256"],
          issuer,
          audience: microsoft.clientId,
          requiredClaims: ["sub", "iat", "exp", "aud", "tid", "oid", "ver"],
          maxTokenAge: "2h",
        });
        if (
          payload.aud !== microsoft.clientId ||
          payload.tid !== microsoft.tenantId ||
          payload.ver !== "2.0" ||
          !payload.exp ||
          typeof payload.oid !== "string" ||
          !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(payload.oid)
        )
          throw new Error("Invalid Microsoft identity.");
        return {
          provider: "microsoft",
          subject: `${payload.tid}:${payload.oid}`,
          human: true,
          expiresAt: payload.exp * 1000,
        };
      }
      return await google(request);
    } catch {
      throw new AccessError(401, "Identity is invalid or expired.");
    }
  };
}
