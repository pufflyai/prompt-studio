import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { bearer } from "better-auth/plugins/bearer";
import { jwt } from "better-auth/plugins/jwt";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { and, eq, sql } from "drizzle-orm";
import { identitySchema } from "pstdio-sync-contracts";
import { type ManagerAuthConfig, parseManagerAuthConfig } from "./auth-config";
import * as authSchema from "./auth-schema";
import { connectManager } from "./database";
import { createDeviceAccess, createDeviceLogin } from "./device-access";
import { accountOfCredential, findDeviceAccess } from "./devices";
import { EnvironmentAccessDenied, EnvironmentAccessFailure } from "./renewal-errors";
import { devices } from "./schema";
import { withAccountTransaction } from "./transactions";

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
    plugins: [
      bearer(),
      oneTimeToken({ storeToken: "hashed", disableClientRequest: true }),
      jwt({
        disableSettingJwtHeader: true,
        jwks: { keyPairConfig: { alg: "EdDSA" } },
        jwt: { issuer: config.origin, audience: config.audience, expirationTime: `${config.accessLifetimeSeconds}s` },
      }),
    ],
  });
  const readSession = (headers: Headers) => auth.api.getSession({ headers, query: { disableCookieCache: true } });
  const deviceLogin = createDeviceLogin(connection.db, readSession);
  return {
    handler: auth.handler,
    // The relay origin comes from the manager's own configuration, never from the client.
    loginDevice: async (headers: Headers, input: unknown) => ({
      ...(await deviceLogin(headers, input)),
      relayOrigin: config.audience,
    }),
    devices: createDeviceAccess(connection.db),
    nativeLogin: (callbackURL: string) =>
      auth.api.signInSocial({ body: { provider: "google", callbackURL }, asResponse: true }),
    nativeCode: (headers: Headers) => auth.api.generateOneTimeToken({ headers }),
    jwks: () => auth.api.getJwks(),
    async renew(token: string, workbenchId: string) {
      identitySchema.parse(workbenchId);
      let category: "database" | "signing" = "database";
      try {
        const accountId = await accountOfCredential(connection.db, token);
        if (!accountId) throw new EnvironmentAccessDenied();
        return await withAccountTransaction(connection.db, accountId, async (transaction) => {
          const access = await findDeviceAccess(transaction, token, workbenchId);
          if (!access) throw new EnvironmentAccessDenied();
          await transaction
            .update(devices)
            .set({ lastSeenAt: sql`clock_timestamp()` })
            .where(and(eq(devices.accountId, access.accountId), eq(devices.id, access.deviceId)));
          const iat = Math.floor(Date.now() / 1000);
          const exp = iat + config.accessLifetimeSeconds;
          category = "signing";
          const signed = await auth.api.signJWT({
            body: {
              payload: {
                tokenType: "pstdio-environment-access",
                accountId: access.accountId,
                workbenchId: access.workbenchId,
                environmentId: access.deviceId,
                sub: access.deviceId,
                iat,
                exp,
              },
            },
          });
          return { token: signed.token, expiresAt: new Date(exp * 1000).toISOString() };
        });
      } catch (error) {
        if (error instanceof EnvironmentAccessDenied) throw error;
        throw new EnvironmentAccessFailure(category);
      }
    },
    close: connection.close,
  };
};
