import { timingSafeEqual } from "node:crypto";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { bearer } from "better-auth/plugins/bearer";
import { jwt } from "better-auth/plugins/jwt";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { and, eq, sql } from "drizzle-orm";
import { identitySchema } from "pstdio-sync-contracts";
import { type ManagerAuthConfig, parseManagerAuthConfig } from "./auth-config";
import * as authSchema from "./auth-schema";
import { digestCredential } from "./credential";
import { connectManager } from "./database";
import { createDeviceAccess, createDeviceLogin } from "./device-access";
import { findDeviceAccess } from "./devices";
import { acknowledgeProjectDeletion, listProjectDeletionJobs } from "./project-deletion";
import { EnvironmentAccessDenied, EnvironmentAccessFailure } from "./renewal-errors";
import { devices } from "./schema";
import { lockAccount, withAccountTransaction } from "./transactions";

export const createManagerAuthentication = (input: ManagerAuthConfig) => {
  const config = parseManagerAuthConfig(input);
  const connection = connectManager(config.databaseUrl);
  const auth = betterAuth({
    // Better Auth adds /api/auth only to a bare origin, so name the full path for addresses with a path.
    baseURL: `${config.origin}/api/auth`,
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
  const relayDigest = config.projectDeletionRelayToken
    ? Buffer.from(digestCredential(config.projectDeletionRelayToken), "hex")
    : null;
  return {
    projectDeletions: {
      enabled: relayDigest !== null,
      authenticate: (token: string) =>
        relayDigest !== null && timingSafeEqual(Buffer.from(digestCredential(token), "hex"), relayDigest),
      jobs: () => listProjectDeletionJobs(connection.db),
      acknowledge: (input: Parameters<typeof acknowledgeProjectDeletion>[1]) =>
        acknowledgeProjectDeletion(connection.db, input),
    },
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
    async renew(token: string, workbenchId: string, accountId?: string) {
      identitySchema.parse(workbenchId);
      let category: "database" | "signing" = "database";
      try {
        const access = await findDeviceAccess(connection.db, token, workbenchId, accountId);
        if (!access) throw new EnvironmentAccessDenied();
        const iat = Math.floor(Date.now() / 1000);
        const exp = iat + config.accessLifetimeSeconds;
        category = "signing";
        // Signing reads its key through the pool. Never hold a transaction's connection while it waits.
        const signed = await auth.api.signJWT({
          body: {
            payload: {
              tokenType: "pstdio-environment-access",
              accountId: access.accountId,
              userId: access.userId,
              workbenchId: access.workbenchId,
              environmentId: access.deviceId,
              sub: access.deviceId,
              iat,
              exp,
            },
          },
        });
        category = "database";
        await withAccountTransaction(connection.db, access.userId, async (transaction) => {
          if (access.accountId !== access.userId) await lockAccount(transaction, access.accountId);
          const current = await findDeviceAccess(transaction, token, workbenchId, accountId);
          if (
            !current ||
            current.accountId !== access.accountId ||
            current.userId !== access.userId ||
            current.deviceId !== access.deviceId ||
            current.workbenchId !== access.workbenchId
          )
            throw new EnvironmentAccessDenied();
          await transaction
            .update(devices)
            .set({ lastSeenAt: sql`clock_timestamp()` })
            .where(and(eq(devices.accountId, access.userId), eq(devices.id, access.deviceId)));
        });
        category = "signing";
        if (Date.now() >= exp * 1000) throw new Error("Prepared access expired before issuance");
        return { token: signed.token, expiresAt: new Date(exp * 1000).toISOString() };
      } catch (error) {
        if (error instanceof EnvironmentAccessDenied) throw error;
        throw new EnvironmentAccessFailure(category);
      }
    },
    close: connection.close,
  };
};
