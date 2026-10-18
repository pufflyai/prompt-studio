import { createManagerAuthentication } from "pstdio-account-manager";

export const fixtureManagerConfig = (databaseUrl: string) => ({
  databaseUrl,
  origin: "https://authority:8443",
  audience: "https://relay.fixture.test",
  secret: "owned-bundled-manager-fixture-secret-0123456789",
  googleClientId: "owned-fixture-client",
  googleClientSecret: "owned-fixture-secret",
  sessionLifetimeSeconds: 120,
  sessionUpdateAgeSeconds: 60,
  accessLifetimeSeconds: 5,
});
export const createFixtureAuthentication = () =>
  createManagerAuthentication(fixtureManagerConfig(process.env.MANAGER_DATABASE_URL!));

export const renewFixtureAccess = async (token: string, workbenchId: string) => {
  const response = await fetch(new URL("/v1/environment-access", process.env.MANAGER_ORIGIN), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ workbenchId }),
  });
  if (!response.ok) throw new Error("Fixture renewal denied");
  return (await response.json()) as { token: string; expiresAt: string };
};
