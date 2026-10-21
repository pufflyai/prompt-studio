import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { testUtils } from "better-auth/plugins";
import * as schema from "./auth-schema";
import { connectManager } from "./database";
import { createManagerAuthentication } from "./manager-authentication";

export const authenticationConfig = (
  databaseUrl: string,
  addresses = { origin: "https://auth.fixture.test", audience: "https://relay.fixture.test" },
) => ({
  databaseUrl,
  ...addresses,
  secret: "disposable-library-secret-fixture-only-0123456789",
  googleClientId: "fixture-google-client",
  googleClientSecret: "fixture-google-secret",
  sessionLifetimeSeconds: 120,
  sessionUpdateAgeSeconds: 60,
  accessLifetimeSeconds: 30,
});

export const createAuthenticationFixture = (
  databaseUrl: string,
  addresses?: Parameters<typeof authenticationConfig>[1],
) => {
  const config = authenticationConfig(databaseUrl, addresses);
  const connection = connectManager(databaseUrl);
  // Privileged library helpers exist only in this fixture's separate auth instance.
  const library = betterAuth({
    baseURL: `${config.origin}/api/auth`,
    secret: config.secret,
    database: drizzleAdapter(connection.db, { provider: "pg", schema }),
    plugins: [testUtils()],
    logger: { disabled: true },
  });
  const auth = createManagerAuthentication(config);
  return {
    auth,
    config,
    connection,
    async login(subject: string, email = `${crypto.randomUUID()}@fixture.test`) {
      const { test } = await library.$context;
      const user = await test.saveUser(test.createUser({ email, emailVerified: true }));
      await connection.db.insert(schema.account).values({
        id: crypto.randomUUID(),
        accountId: subject,
        providerId: "google",
        userId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { ...(await test.login({ userId: user.id })), subject };
    },
    close: () => Promise.all([auth.close(), connection.close()]),
  };
};
