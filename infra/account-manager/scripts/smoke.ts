import { strict as assert } from "node:assert";
import { createAuthorityFixture, provisionAccount, registration } from "../src/authority.fixture";
import { createGoogleFixture } from "../src/google-identity.fixture";

const implementation: typeof import("../src/index") = await import(new URL("./authority.js", import.meta.url).href);
const fixture = createAuthorityFixture(implementation);
const owners: ReturnType<typeof implementation.createAccountManager>[] = [];
try {
  await fixture.initialize(new URL("./drizzle", import.meta.url).pathname);
  const first = fixture.owner();
  owners.push(first);
  const accountId = await provisionAccount(first);
  const intent = registration(accountId);
  const grant = await first.register(intent);
  assert.ok(grant.token);
  await first.close();
  const reopened = fixture.owner();
  owners.push(reopened);
  assert.deepEqual(await reopened.authorize(grant.token, intent.workbenchId), {
    accountId,
    workbenchId: intent.workbenchId,
    environmentId: intent.environmentId,
  });
  assert.equal((await reopened.register(intent)).token, null);
  const snapshot = await reopened.snapshot();
  assert.ok(!JSON.stringify(snapshot).includes(grant.token));
  const laterIntent = registration(accountId);
  const later = await reopened.register(laterIntent);
  await reopened.revoke({ requestId: "revoke", accountId, environmentId: intent.environmentId });
  assert.equal(await reopened.authorize(grant.token, intent.workbenchId), null);
  await reopened.restore("restore", snapshot);
  assert.equal(await reopened.authorize(grant.token, intent.workbenchId), null);
  await reopened.reconcile({
    requestId: "current-authority",
    accountId,
    owner: { issuer: "https://accounts.google.com", subject: accountId },
    state: "active",
  });
  const fresh = await reopened.register(registration(accountId));
  assert.ok(fresh.token);
  assert.deepEqual(await reopened.register(laterIntent), { ...later, token: null });
  await assert.rejects(reopened.register({ ...laterIntent, environmentId: "changed" }));
  await reopened.restore("restore", snapshot);
  assert.ok(await reopened.authorize(fresh.token, fresh.workbenchId));
  const google = await createGoogleFixture();
  try {
    const verify = implementation.createGoogleIdentityVerifier(google.clientId, google.transport);
    for (const [key, issuer] of ["https://accounts.google.com", "accounts.google.com"].entries()) {
      assert.deepEqual(await verify(await google.sign({ iss: issuer }, key), google.nonce), {
        issuer: "https://accounts.google.com",
        subject: google.subject,
      });
    }
    assert.equal(google.requests(), 1);
    await assert.rejects(verify(await google.sign(), "another-login"));
    const privateProfile = "private-profile-from-rejected-token";
    const rejected = await google.sign({ aud: "another-client", email: privateProfile });
    const error = await verify(rejected, google.nonce).catch((reason: unknown) => reason);
    assert.ok(error instanceof Error);
    assert.ok(!Bun.inspect(error, { depth: Infinity }).includes(privateProfile));
    assert.ok(!Bun.inspect(error, { depth: Infinity }).includes(rejected));
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const login = async () => {
      const challenge = await reopened.beginLogin({ expiresAt });
      const pending = await reopened.loginChallenge(challenge.state, challenge.binding);
      assert.ok(pending);
      const verified = await verify(await google.sign({ sub: accountId, nonce: pending.nonce }), pending.nonce);
      return reopened.completeLogin({
        state: challenge.state,
        binding: challenge.binding,
        accountId,
        owner: verified,
        expiresAt,
      });
    };
    const session = await login();
    assert.deepEqual(await reopened.authorizeSession(session.token), { accountId });
    const access = reopened.forOwnerSession(session.token);
    const ownerIntent = {
      requestId: "owner-registration",
      workbenchId: "owner-workbench",
      environmentId: "owner-environment",
      expiresAt,
    };
    await assert.rejects(access.register({ ...ownerIntent, ...{ accountId: "another-account" } }));
    const ownerGrant = await access.register(ownerIntent);
    assert.ok(ownerGrant.token);
    assert.equal(ownerGrant.accountId, accountId);
    assert.deepEqual(await access.register(ownerIntent), { ...ownerGrant, token: null });
    assert.ok((await access.environments()).some((entry) => entry.id === ownerGrant.id));
    const replacement = { ...ownerIntent, requestId: "owner-replacement", replacesId: ownerGrant.id };
    const replaced = await access.replace(replacement);
    assert.ok(replaced.token);
    assert.deepEqual(await access.replace(replacement), { ...replaced, token: null });
    assert.equal(await reopened.authorize(ownerGrant.token, ownerGrant.workbenchId), null);
    const revoke = { requestId: "owner-revocation", environmentId: ownerIntent.environmentId };
    await access.revoke(revoke);
    await access.revoke(revoke);
    assert.equal(await reopened.authorize(replaced.token, replaced.workbenchId), null);
    const pendingLogin = await reopened.beginLogin({ expiresAt });
    const loginSnapshot = await reopened.snapshot();
    assert.ok(!JSON.stringify(loginSnapshot).includes(session.token));
    await reopened.restore("restore-owner-sessions", loginSnapshot);
    assert.equal(await reopened.authorizeSession(session.token), null);
    await assert.rejects(access.environments());
    await assert.rejects(access.register(ownerIntent));
    assert.equal(await reopened.loginChallenge(pendingLogin.state, pendingLogin.binding), null);
    await reopened.reconcile({
      requestId: "current-owner-for-login",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    const currentSession = await login();
    const currentAccess = reopened.forOwnerSession(currentSession.token);
    const currentIntent = { ...ownerIntent, requestId: "fresh-owner-registration" };
    const currentGrant = await currentAccess.register(currentIntent);
    assert.ok(currentGrant.token);
    await reopened.restore("restore-owner-sessions", loginSnapshot);
    assert.deepEqual(await reopened.authorizeSession(currentSession.token), { accountId });
    assert.ok(await reopened.authorize(currentGrant.token, currentGrant.workbenchId));
    await reopened.logout(currentSession.token);
    assert.equal(await reopened.authorizeSession(currentSession.token), null);
    await assert.rejects(currentAccess.environments());
    await assert.rejects(currentAccess.register(currentIntent));
  } finally {
    await google.close();
  }
  console.log("Built private manager authority, recovery, Google identity, owner login and environment access passed");
} finally {
  await Promise.all(owners.map((owner) => owner.close()));
  await fixture.close();
}
