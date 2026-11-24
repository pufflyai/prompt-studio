import { timingSafeEqual } from "node:crypto";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { bearer } from "better-auth/plugins/bearer";
import { jwt } from "better-auth/plugins/jwt";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { and, eq, lte, sql } from "drizzle-orm";
import { type AccountSignInProvider, identitySchema, teamInviteEmailSchema } from "pstdio-sync-contracts";
import { type ManagerAuthConfig, parseManagerAuthConfig } from "./auth-config";
import * as authSchema from "./auth-schema";
import { digestCredential } from "./credential";
import { connectManager } from "./database";
import { createDeviceAccess, createDeviceLogin, createPersonalAccountAccess } from "./device-access";
import { findDeviceAccess } from "./devices";
import { microsoftSignIn } from "./microsoft-provider";
import { type NativeLoginAttempt, nativeApprovalId, nativeLoginApproval } from "./native-login-approval";
import { acknowledgeProjectDeletion, listProjectDeletionJobs } from "./project-deletion";
import { readProviderIdentity } from "./provider-identity";
import { EnvironmentAccessDenied, EnvironmentAccessFailure } from "./renewal-errors";
import { devices, googleIdentityClaims, microsoftIdentityClaims } from "./schema";
import { acceptTeamInvitation, inspectTeamInvitation, teamInvitationProvider } from "./team-invitations";
import { canPublishForTeam, prepareTeamPublicationGrant, sameDeviceAccess } from "./team-publication-access";
import { lockAccount, withAccountTransaction } from "./transactions";

export const createManagerAuthentication = (input: ManagerAuthConfig) => {
  const config = parseManagerAuthConfig(input);
  const connection = connectManager(config.databaseUrl, config.databasePoolMax);
  const rememberDirectoryClaim: Parameters<typeof microsoftSignIn>[1] = async (claim) => {
    const [stored] = await connection.db
      .insert(microsoftIdentityClaims)
      .values(claim)
      .onConflictDoUpdate({
        target: [microsoftIdentityClaims.issuer, microsoftIdentityClaims.subject],
        set: { objectId: claim.objectId },
        setWhere: eq(microsoftIdentityClaims.objectId, claim.objectId),
      })
      .returning({ objectId: microsoftIdentityClaims.objectId });
    return stored !== undefined;
  };
  const auth = betterAuth({
    // Better Auth adds /api/auth only to a bare origin, so name the full path for addresses with a path.
    baseURL: `${config.origin}/api/auth`,
    secret: config.secret,
    database: drizzleAdapter(connection.db, { provider: "pg", schema: authSchema }),
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        async mapProfileToUser(profile) {
          const issuedAt = profile.iat;
          if (!Number.isInteger(issuedAt) || !profile.sub) return {};
          const email = teamInviteEmailSchema.safeParse(profile.email);
          const verifiedEmail = profile.email_verified === true && email.success ? email.data : null;
          // An older provider token cannot roll back the invitation identity. A conflict at the
          // same provider timestamp requires fresh sign-in before either address can accept.
          await connection.db
            .insert(googleIdentityClaims)
            .values({ subject: profile.sub, issuedAt, verifiedEmail })
            .onConflictDoUpdate({
              target: googleIdentityClaims.subject,
              set: {
                issuedAt,
                verifiedEmail: sql`case
                  when ${googleIdentityClaims.issuedAt} = ${issuedAt}
                    and ${googleIdentityClaims.verifiedEmail} is distinct from ${verifiedEmail}
                  then null
                  else ${verifiedEmail}
                end`,
              },
              setWhere: lte(googleIdentityClaims.issuedAt, issuedAt),
            });
          return {};
        },
      },
      microsoft: config.microsoft
        ? {
            ...config.microsoft,
            tenantId: "common",
            disableDefaultScope: true,
            scope: ["openid", "profile"],
            disableProfilePhoto: true,
          }
        : undefined,
    },
    session: { expiresIn: config.sessionLifetimeSeconds, updateAge: config.sessionUpdateAgeSeconds },
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true },
    logger: { disabled: true },
    disabledPaths: ["/token"],
    plugins: [
      ...(config.microsoft ? [microsoftSignIn(config.microsoft.clientId, rememberDirectoryClaim)] : []),
      bearer(),
      nativeLoginApproval,
      oneTimeToken({ storeToken: "hashed", disableClientRequest: true }),
      jwt({
        disableSettingJwtHeader: true,
        jwks: { keyPairConfig: { alg: "EdDSA" } },
        jwt: { issuer: config.origin, audience: config.audience, expirationTime: `${config.accessLifetimeSeconds}s` },
      }),
    ],
  });
  const readSession = (headers: Headers) => auth.api.getSession({ headers, query: { disableCookieCache: true } });
  const withPersonalAccount = createPersonalAccountAccess(connection.db, readSession);
  const deviceLogin = createDeviceLogin(withPersonalAccount);
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
    teamInvitation: {
      provider: (secret: string) => teamInvitationProvider(connection.db, secret),
      inspect: (headers: Headers, secret: string) =>
        withPersonalAccount(headers, (transaction, userId) => inspectTeamInvitation(transaction, userId, secret)),
      accept: (headers: Headers, secret: string) =>
        withPersonalAccount(headers, (transaction, userId) => acceptTeamInvitation(transaction, userId, secret)),
    },
    supportsSignIn: (provider: AccountSignInProvider) => provider === "google" || !!config.microsoft,
    nativeLogin: (provider: AccountSignInProvider, callbackURL: string, errorCallbackURL: string) =>
      auth.api.signInSocial({ body: { provider, callbackURL, errorCallbackURL }, asResponse: true }),
    async nativeCode(headers: Headers, attempt: NativeLoginAttempt) {
      const session = await readSession(headers);
      if (!session) throw new Error("Sign-in session unavailable");
      const identity = await readProviderIdentity(connection.db, session.user.id);
      if (identity?.provider !== attempt.provider) throw new Error("Sign-in provider did not match");
      const { internalAdapter } = await auth.$context;
      const approval = await internalAdapter.consumeVerificationValue(nativeApprovalId(session.session.id, attempt));
      if (!approval) throw new Error("Native sign-in approval unavailable");
      return auth.api.generateOneTimeToken({ headers });
    },
    jwks: () => auth.api.getJwks(),
    async renew(token: string, workbenchId: string, accountId?: string, grantId?: string) {
      identitySchema.parse(workbenchId);
      let category: "database" | "signing" = "database";
      try {
        const access = await findDeviceAccess(connection.db, token, workbenchId, accountId);
        if (!access || access.grantId !== grantId) throw new EnvironmentAccessDenied();
        const publication = await prepareTeamPublicationGrant(connection.db, access, token);
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
              ...(publication && { publication }),
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
            !sameDeviceAccess(access, current) ||
            (publication && (await canPublishForTeam(transaction, current)) !== publication.canWrite)
          )
            throw new EnvironmentAccessDenied();
          await transaction
            .update(devices)
            .set({ lastSeenAt: sql`clock_timestamp()` })
            .where(and(eq(devices.accountId, access.userId), eq(devices.id, access.deviceId)));
        });
        category = "signing";
        if (Date.now() >= exp * 1000) throw new Error("Prepared access expired before issuance");
        return {
          token: signed.token,
          expiresAt: new Date(exp * 1000).toISOString(),
          ...(publication && { canPublish: publication.canWrite }),
        };
      } catch (error) {
        if (error instanceof EnvironmentAccessDenied) throw error;
        throw new EnvironmentAccessFailure(category);
      }
    },
    close: connection.close,
  };
};
