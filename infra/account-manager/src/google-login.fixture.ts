import { createAuthorityFixture } from "./authority.fixture";
import { createGoogleFixture } from "./google-identity.fixture";
import type * as Authority from "./index";

export const createLoginFixture = (implementation: typeof Authority) => {
  const fixture = createAuthorityFixture(implementation);
  let google: Awaited<ReturnType<typeof createGoogleFixture>>;
  let verify: ReturnType<typeof implementation.createGoogleIdentityVerifier>;
  return {
    ...fixture,
    async initialize() {
      await fixture.initialize();
      google = await createGoogleFixture();
      verify = implementation.createGoogleIdentityVerifier(google.clientId, google.transport);
    },
    async intent(
      owner: ReturnType<typeof implementation.createAccountManager>,
      accountId: string,
      expiresAt = new Date(Date.now() + 60_000).toISOString(),
    ) {
      const challenge = await owner.beginLogin({ expiresAt: new Date(Date.now() + 60_000).toISOString() });
      const pending = await owner.loginChallenge(challenge.state, challenge.binding);
      if (!pending) throw new Error("Fresh fixture challenge is unavailable");
      const verified = await verify(await google.sign({ sub: accountId, nonce: pending.nonce }), pending.nonce);
      return { state: challenge.state, binding: challenge.binding, accountId, owner: verified, expiresAt };
    },
    close: () => Promise.all([fixture.close(), google.close()]),
  };
};
