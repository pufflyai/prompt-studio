import type { BetterAuthPlugin } from "better-auth";
import { createLocalJWKSet, decodeJwt, jwtVerify } from "jose";
import { z } from "zod";
import { digestCredential } from "./credential";

const authority = "https://login.microsoftonline.com";
const tenantPattern = "[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}";
const tenantSchema = z.string().regex(new RegExp(`^${tenantPattern}$`));
export const microsoftIssuerSchema = z
  .string()
  .regex(new RegExp(`^${authority.replaceAll(".", "\\.")}/${tenantPattern}/v2\\.0$`));
export const microsoftIssuer = (tenant: string) => `${authority}/${tenant}/v2.0`;

const identity = z.object({
  tid: tenantSchema,
  sub: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[\x21-\x7e]+$/),
});
const claims = identity.extend({ name: z.string().optional(), nonce: z.string(), ver: z.literal("2.0") });
const keySet = z.object({ keys: z.array(z.object({ issuer: z.string().optional(), kty: z.string() }).passthrough()) });

export const microsoftAccountIdentity = (key: string) => {
  const separator = key.indexOf(":");
  if (separator === -1) return null;
  const subject = identity.safeParse({ tid: key.slice(0, separator), sub: key.slice(separator + 1) });
  return subject.success ? { issuer: microsoftIssuer(subject.data.tid), subject: subject.data.sub } : null;
};

type DirectoryClaim = { issuer: string; subject: string; tenantId: string; objectId: string };

export const microsoftSignIn = (
  clientId: string,
  rememberDirectoryClaim: (claim: DirectoryClaim) => Promise<boolean>,
): BetterAuthPlugin => ({
  id: "cloud-microsoft-sign-in",
  init(context) {
    const provider = context.socialProviders.find(({ id }) => id === "microsoft");
    if (!provider) throw new Error("Microsoft sign-in provider is missing");
    const authorize = provider.createAuthorizationURL.bind(provider);
    provider.requiresIdTokenNonce = true;
    provider.createAuthorizationURL = async (data) => {
      const url = await authorize(data);
      if (!data.idTokenNonce) throw new Error("Missing Microsoft sign-in nonce");
      url.searchParams.set("nonce", data.idTokenNonce);
      return url;
    };

    // Allow only the authorization-code path. Its server-controlled nonce binds the verified ID token to this login.
    provider.idToken = undefined;
    provider.accountSubject = ({ profile }) => {
      const { tid, sub } = identity.parse(profile);
      return `${tid}:${sub}`;
    };
    provider.getUserInfo = async ({ idToken, expectedIdTokenNonce }) => {
      if (!idToken || !expectedIdTokenNonce) return null;
      try {
        // Use the untrusted tenant only to narrow keys from the fixed Microsoft JWKS endpoint.
        const tenant = tenantSchema.parse(decodeJwt(idToken).tid);
        const issuer = microsoftIssuer(tenant);
        const response = await fetch(`${authority}/common/discovery/v2.0/keys`, {
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) return null;
        const { keys } = keySet.parse(await response.json());
        const jwks = createLocalJWKSet({
          keys: keys.filter((key) => key.kty === "RSA" && key.issuer?.replace("{tenantid}", tenant) === issuer),
        });
        const { payload } = await jwtVerify(idToken, jwks, {
          algorithms: ["RS256"],
          audience: clientId,
          issuer,
          clockTolerance: 30,
          maxTokenAge: "1h",
          requiredClaims: ["exp", "iat", "sub"],
        });
        const profile = claims.parse(payload);
        if (payload.aud !== clientId || profile.nonce !== expectedIdTokenNonce) return null;

        const objectId = z.string().toLowerCase().pipe(z.guid()).safeParse(payload.oid);
        if (
          objectId.success &&
          !(await rememberDirectoryClaim({
            issuer,
            subject: profile.sub,
            tenantId: profile.tid,
            objectId: objectId.data,
          }))
        )
          return null;

        // Better Auth requires a unique email. Use a reserved provider-scoped value so unverified
        // and optional email claims cannot occupy another provider's address or block account creation.
        return {
          user: {
            name: profile.name ?? "Microsoft account",
            email: `${digestCredential(`${issuer}\n${profile.sub}`)}@microsoft.invalid`,
            emailVerified: false,
          },
          data: profile,
        };
      } catch {
        return null;
      }
    };
  },
});
