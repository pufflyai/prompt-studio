import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins/jwt";
import { and, eq, isNull, sql } from "drizzle-orm";
import { identitySchema } from "pstdio-sync-contracts";
import { type ManagerAuthConfig, parseManagerAuthConfig } from "./auth-config";
import * as authSchema from "./auth-schema";
import { digestCredential } from "./credential";
import { connectManager } from "./database";
import { accounts, credentials } from "./schema";

export const createManagerAuthentication = (input: ManagerAuthConfig) => {
  const config = parseManagerAuthConfig(input);
  const connection = connectManager(config.databaseUrl);
  const auth = betterAuth({
    baseURL: config.origin,
    secret: config.secret,
    database: drizzleAdapter(connection.db, { provider: "pg", schema: authSchema }),
    socialProviders: { google: { clientId: config.googleClientId, clientSecret: config.googleClientSecret } },
    session: { expiresIn: config.sessionLifetimeSeconds, updateAge: config.sessionUpdateAgeSeconds },
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true },
    logger: { disabled: true },
    disabledPaths: ["/token"],
    plugins: [jwt({
      disableSettingJwtHeader: true,
      jwks: { keyPairConfig: { alg: "EdDSA" } },
      jwt: { issuer: config.origin, audience: config.audience, expirationTime: `${config.accessLifetimeSeconds}s` },
    })],
  });
  return {
    handler: auth.handler,
    jwks: () => auth.api.getJwks(),
    async renew(token: string, workbenchId: string) {
      try {
        identitySchema.parse(workbenchId);
        const [grant] = await connection.db.select({
          accountId: credentials.accountId,
          workbenchId: credentials.workbenchId,
          environmentId: credentials.environmentId,
          expiresAt: credentials.expiresAt,
        }).from(credentials).innerJoin(accounts, eq(accounts.id, credentials.accountId)).where(and(
          eq(credentials.digest, digestCredential(token)),
          eq(credentials.workbenchId, workbenchId),
          eq(accounts.state, "active"),
          isNull(credentials.revokedAt),
          sql`${credentials.expiresAt} > clock_timestamp()`,
        ));
        if (!grant) throw new Error("Unavailable grant");
        const iat = Math.floor(Date.now() / 1000);
        const exp = Math.min(iat + config.accessLifetimeSeconds, Math.floor(grant.expiresAt.getTime() / 1000));
        if (exp <= iat) throw new Error("Expired grant");
        const signed = await auth.api.signJWT({ body: { payload: {
          tokenType: "pstdio-environment-access",
          accountId: grant.accountId,
          workbenchId: grant.workbenchId,
          environmentId: grant.environmentId,
          sub: grant.environmentId,
          iat,
          exp,
        } } });
        return { token: signed.token, expiresAt: new Date(exp * 1000).toISOString() };
      } catch {
        throw new Error("Environment access unavailable");
      }
    },
    close: connection.close,
  };
};
