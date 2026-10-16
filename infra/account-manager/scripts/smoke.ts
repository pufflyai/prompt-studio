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
  } finally {
    google.close();
  }
  console.log("Built private manager authority, recovery and Google identity verification passed");
} finally {
  await Promise.all(owners.map((owner) => owner.close()));
  await fixture.close();
}
