import { afterAll, beforeAll, expect, test } from "bun:test";
import { generateKeyPair, SignJWT } from "jose";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("the independent verifier requires signed, finite, scoped environment access", async () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  try {
    const accountId = await provisionAccount(manager);
    const grant = await manager.register(registration(accountId));
    const issued = await authentication.auth.renew(grant.token!, grant.workbenchId);
    const trust = {
      issuer: authentication.config.origin,
      audience: authentication.config.audience,
      jwks: await authentication.auth.jwks(),
    };
    const verify = implementation.createEnvironmentAccessVerifier(trust);
    expect(await verify(issued.token)).toMatchObject({
      accountId,
      workbenchId: grant.workbenchId,
      environmentId: grant.environmentId,
    });
    await expect(
      implementation.createEnvironmentAccessVerifier({ ...trust, audience: "https://different.test" })(issued.token),
    ).rejects.toThrow();
    await expect(verify("not-a-token")).rejects.toThrow();
    const { privateKey } = await generateKeyPair("EdDSA");
    const forged = await new SignJWT({
      tokenType: "pstdio-environment-access",
      accountId,
      workbenchId: grant.workbenchId,
      environmentId: grant.environmentId,
    })
      .setProtectedHeader({ alg: "EdDSA", kid: trust.jwks.keys[0].kid })
      .setIssuedAt()
      .setExpirationTime("1m")
      .setIssuer(trust.issuer)
      .setAudience(trust.audience)
      .setSubject(grant.environmentId)
      .sign(privateKey);
    await expect(verify(forged)).rejects.toThrow();
    await manager.revoke({ requestId: "stop-renewal", accountId, environmentId: grant.environmentId });
    expect(await verify(issued.token)).toMatchObject({ accountId });
    await expect(authentication.auth.renew(grant.token!, grant.workbenchId)).rejects.toThrow();
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});
