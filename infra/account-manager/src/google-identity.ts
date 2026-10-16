import { createRemoteJWKSet, customFetch, type FetchImplementation, jwtVerify } from "jose";
import { z } from "zod";
import { ownerSchema } from "./contracts";

const contextSchema = z.string().min(1);
const claimsSchema = z.object({
  sub: z
    .string()
    .min(1)
    .max(255)
    .regex(/^\p{ASCII}+$/u),
  aud: z.union([contextSchema, z.array(contextSchema).min(1)]),
  azp: contextSchema.optional(),
  nonce: contextSchema,
  iat: z.number().int().nonnegative(),
  exp: z.number().int().nonnegative(),
});

export const createGoogleIdentityVerifier = (clientId: string, transport?: FetchImplementation) => {
  const audience = contextSchema.parse(clientId);
  const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), {
    [customFetch]: transport,
  });
  return async (token: string, expectedNonce: string) => {
    try {
      const nonce = contextSchema.parse(expectedNonce);
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ["RS256"],
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience,
        requiredClaims: ["sub", "iat", "exp", "nonce"],
      });
      const claims = claimsSchema.parse(payload);
      const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (
        claims.nonce !== nonce ||
        audiences.some((value) => value !== audience) ||
        (claims.azp !== undefined && claims.azp !== audience)
      )
        throw new Error("Google ID token does not match the pending web login");
      if (claims.iat > Math.floor(Date.now() / 1000) || claims.iat >= claims.exp)
        throw new Error("Google ID token has invalid issuance time");
      return ownerSchema.parse({ issuer: "https://accounts.google.com", subject: claims.sub });
    } catch {
      // JOSE errors retain rejected claims, so discard the original error and cause.
      throw new Error("Google identity verification failed");
    }
  };
};
