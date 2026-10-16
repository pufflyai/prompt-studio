import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, provisionAccount } from "./authority.fixture";
import { createGoogleCodeFixture } from "./google-code.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
let google: Awaited<ReturnType<typeof createGoogleCodeFixture>>;
beforeAll(async () => {
  await fixture.initialize();
  google = await createGoogleCodeFixture();
});
afterAll(() => Promise.all([fixture.close(), google.close()]));

test("a durable Google code flow creates current owner environment authority after restart", async () => {
  const owner = fixture.owner();
  const reopened = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const login = implementation.createGoogleLogin(owner, google.config, google.transport);
    const begun = await login.begin({ expiresAt });
    expect(begun.authorizationUrl).not.toContain(begun.binding);
    expect(begun.authorizationUrl).not.toContain(google.config.clientSecret);
    const callback = await google.authorize(begun.authorizationUrl, accountId);
    await owner.close();
    const resumed = implementation.createGoogleLogin(reopened, google.config, google.transport);
    const session = await resumed.complete({ ...callback, binding: begun.binding, accountId, expiresAt });
    expect(Object.keys(session).sort()).toEqual(["accountId", "expiresAt", "token"]);
    expect(await reopened.authorizeSession(session.token)).toEqual({ accountId });
    const grant = await reopened.forOwnerSession(session.token).register({
      requestId: "code-flow-registration",
      workbenchId: "workbench",
      environmentId: "laptop",
      expiresAt,
    });
    expect(await reopened.authorize(grant.token!, grant.workbenchId)).toEqual({
      accountId,
      workbenchId: grant.workbenchId,
      environmentId: grant.environmentId,
    });
    const saved = JSON.stringify({ session, snapshot: await reopened.snapshot() });
    for (const secret of [begun.binding, callback.code, google.config.clientSecret, ...google.issuedTokens])
      expect(saved).not.toContain(secret);
    expect(google.tokenRequests()).toBe(1);
  } finally {
    await Promise.all([owner.close(), reopened.close()]);
  }
});

test("invalid Google configuration keeps credential-like input out of error details", async () => {
  const owner = fixture.owner();
  try {
    let failure: unknown;
    try {
      implementation.createGoogleLogin(owner, { ...google.config, redirectUri: google.config.clientSecret });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(Bun.inspect(failure, { depth: Infinity })).not.toContain(google.config.clientSecret);
  } finally {
    await owner.close();
  }
});
