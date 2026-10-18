import { expect, test } from "bun:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { createEnvironmentAccessVerifier } from "./environment-access";

test("signed tokens still require finite expiry, current time, product type and exact environment subject", async () => {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA");
  const jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: "claims-key", alg: "EdDSA" }] };
  const issuer = "https://issuer.fixture.test";
  const audience = "https://relay.fixture.test";
  const verify = createEnvironmentAccessVerifier({ issuer, audience, jwks });
  const now = Math.floor(Date.now() / 1000);
  const valid = {
    iss: issuer,
    aud: audience,
    tokenType: "pstdio-environment-access",
    accountId: "account",
    workbenchId: "workbench",
    environmentId: "environment",
    sub: "environment",
    iat: now,
    exp: now + 30,
  };
  const sign = (payload: Record<string, unknown>) =>
    new SignJWT(payload).setProtectedHeader({ alg: "EdDSA", kid: "claims-key" }).sign(privateKey);
  expect(await verify(await sign(valid))).toMatchObject({ accountId: "account" });
  for (const invalid of [
    { ...valid, exp: undefined },
    { ...valid, exp: now - 1 },
    { ...valid, iat: now + 60, exp: now + 90 },
    { ...valid, tokenType: "human-session" },
    { ...valid, sub: "another-environment" },
    { ...valid, accountId: "" },
    { ...valid, workbenchId: "" },
    { ...valid, environmentId: "" },
    { ...valid, iss: "https://other.fixture.test" },
    { ...valid, aud: "another-service" },
  ])
    await expect(verify(await sign(invalid))).rejects.toThrow("Environment access unavailable");
});
