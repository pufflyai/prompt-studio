import { createLocalJWKSet, type JSONWebKeySet, jwtVerify } from "jose";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";

const trust = z.strictObject({
  issuer: z.url().refine((value) => new URL(value).protocol === "https:"),
  audience: z.url().refine((value) => new URL(value).protocol === "https:"),
  jwks: z.strictObject({
    keys: z
      .array(
        z.strictObject({
          kty: z.literal("OKP"),
          crv: z.literal("Ed25519"),
          x: z.string().min(1),
          kid: z.string().min(1),
          alg: z.literal("EdDSA").optional(),
          use: z.literal("sig").optional(),
        }),
      )
      .min(1),
  }),
});
const claims = z
  .object({
    tokenType: z.literal("pstdio-environment-access"),
    accountId: identitySchema,
    workbenchId: identitySchema,
    environmentId: identitySchema,
    sub: identitySchema,
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
  })
  .refine((value) => value.sub === value.environmentId && value.exp > value.iat && value.iat <= Date.now() / 1000);

export interface EnvironmentAccessTrust {
  issuer: string;
  audience: string;
  jwks: JSONWebKeySet;
}

export const createEnvironmentAccessVerifier = (input: EnvironmentAccessTrust) => {
  const parsed = trust.safeParse(input);
  if (!parsed.success) throw new Error("Invalid environment access trust");
  const keys = createLocalJWKSet(parsed.data.jwks);
  return async (token: string) => {
    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ["EdDSA"],
        issuer: parsed.data.issuer,
        audience: parsed.data.audience,
        requiredClaims: ["iss", "aud", "sub", "iat", "exp"],
      });
      const access = claims.parse(payload);
      return {
        accountId: access.accountId,
        workbenchId: access.workbenchId,
        environmentId: access.environmentId,
        expiresAt: new Date(access.exp * 1000).toISOString(),
      };
    } catch {
      throw new Error("Environment access unavailable");
    }
  };
};
