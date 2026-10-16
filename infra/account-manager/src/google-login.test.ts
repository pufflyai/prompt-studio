import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, provisionAccount } from "./authority.fixture";
import { createGoogleFixture } from "./google-identity.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
let google: Awaited<ReturnType<typeof createGoogleFixture>>;
beforeAll(async () => {
  await fixture.initialize();
  google = await createGoogleFixture();
});
afterAll(() => Promise.all([fixture.close(), google.close()]));

test("a browser-bound Google login creates a durable current account session", async () => {
  const first = fixture.owner();
  const second = fixture.owner();
  const reopened = fixture.owner();
  try {
    const accountId = await provisionAccount(first);
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const challenge = await first.beginLogin({ expiresAt });
    await first.close();
    const pending = await second.loginChallenge(challenge.state, challenge.binding);
    expect(pending).toEqual({ nonce: challenge.nonce });
    const verify = implementation.createGoogleIdentityVerifier(google.clientId, google.transport);
    const token = await google.sign({ sub: accountId, nonce: pending!.nonce });
    const verifiedOwner = await verify(token, pending!.nonce);
    const session = await second.completeLogin({
      state: challenge.state,
      binding: challenge.binding,
      accountId,
      owner: verifiedOwner,
      expiresAt,
    });
    await second.close();
    expect(session.token).toBeString();
    expect(await reopened.authorizeSession(session.token)).toEqual({ accountId });
    expect(await reopened.loginChallenge(challenge.state, challenge.binding)).toBeNull();
  } finally {
    await Promise.all([first.close(), second.close(), reopened.close()]);
  }
});
