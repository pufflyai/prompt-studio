import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { provisionAccount } from "./authority.fixture";
import { createLoginFixture } from "./google-login.fixture";
import * as implementation from "./index";

const fixture = createLoginFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());
const registration = () => ({
  requestId: "registration",
  workbenchId: "workbench",
  environmentId: "laptop",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
});

test("owner operation inputs reject caller account and identity claims without consuming the intent", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const otherId = await provisionAccount(owner);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const access = owner.forOwnerSession(session.token);
    const intent = registration();
    await expect(access.register({ ...intent, ...{ accountId: otherId } })).rejects.toThrow();
    await expect(
      access.register({ ...intent, ...{ owner: { issuer: "https://accounts.google.com", subject: otherId } } }),
    ).rejects.toThrow();
    const grant = await access.register(intent);
    expect(grant.token).toBeString();
    const replacement = { ...intent, requestId: "replacement", replacesId: grant.id };
    await expect(access.replace({ ...replacement, ...{ accountId: otherId } })).rejects.toThrow();
    const fresh = await access.replace(replacement);
    expect(fresh.token).toBeString();
    const revoke = { requestId: "revoke", environmentId: intent.environmentId };
    await expect(access.revoke({ ...revoke, ...{ accountId: otherId } })).rejects.toThrow();
    expect(await owner.authorize(fresh.token!, fresh.workbenchId)).not.toBeNull();
    await access.revoke(revoke);
    expect(await owner.authorize(fresh.token!, fresh.workbenchId)).toBeNull();
    expect(await owner.environments(otherId)).toEqual([]);
  } finally {
    await owner.close();
  }
});

test("a retained facade cannot use logged-out authority for reads, mutations or receipt retries", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const access = owner.forOwnerSession(session.token);
    const intent = registration();
    const grant = await access.register(intent);
    const replacement = { ...intent, requestId: "replacement", replacesId: grant.id };
    const fresh = await access.replace(replacement);
    const revoke = { requestId: "revoke-absent", environmentId: "another-environment" };
    await access.revoke(revoke);
    await owner.logout(session.token);
    await expect(access.environments()).rejects.toThrow();
    await expect(access.register(intent)).rejects.toThrow();
    await expect(access.replace(replacement)).rejects.toThrow();
    await expect(access.revoke(revoke)).rejects.toThrow();
    expect(await owner.authorize(fresh.token!, fresh.workbenchId)).not.toBeNull();
    const current = await owner.completeLogin(await fixture.intent(owner, accountId));
    expect(await owner.forOwnerSession(current.token).replace(replacement)).toEqual({ ...fresh, token: null });
  } finally {
    await owner.close();
  }
});

test("owner permission expires against database time even while an environment grant remains live", async () => {
  const owner = fixture.owner();
  const sql = new SQL(fixture.databaseUrl);
  try {
    const accountId = await provisionAccount(owner);
    const expiry = new Date(Date.now() + 1000).toISOString();
    const session = await owner.completeLogin(await fixture.intent(owner, accountId, expiry));
    const access = owner.forOwnerSession(session.token);
    const intent = registration();
    const grant = await access.register(intent);
    while ((await sql`SELECT clock_timestamp() < ${expiry}::timestamptz AS waiting`)[0].waiting) await Bun.sleep(10);
    await expect(access.environments()).rejects.toThrow();
    await expect(access.register(intent)).rejects.toThrow();
    await expect(access.replace({ ...intent, requestId: "replacement", replacesId: grant.id })).rejects.toThrow();
    await expect(access.revoke({ requestId: "revoke", environmentId: intent.environmentId })).rejects.toThrow();
    expect(await owner.authorize(grant.token!, grant.workbenchId)).not.toBeNull();
  } finally {
    await Promise.all([owner.close(), sql.close()]);
  }
});

test("account lifecycle invalidates retained owner management permission without reviving it", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const access = owner.forOwnerSession(session.token);
    const intent = registration();
    await access.register(intent);
    await owner.disable({ requestId: "disable", accountId });
    await expect(access.environments()).rejects.toThrow();
    await expect(access.register(intent)).rejects.toThrow();
    await owner.reconcile({
      requestId: "current-owner",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    await expect(access.register(intent)).rejects.toThrow();
    const fresh = await owner.completeLogin(await fixture.intent(owner, accountId));
    const freshAccess = owner.forOwnerSession(fresh.token);
    expect((await freshAccess.register(intent)).token).toBeNull();
    await owner.reconcile({
      requestId: "changed-owner",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: "another-google-owner" },
      state: "active",
    });
    await expect(freshAccess.environments()).rejects.toThrow();
    await expect(freshAccess.register({ ...intent, requestId: "new-registration" })).rejects.toThrow();
  } finally {
    await owner.close();
  }
});

test("owned restore closes old owner management while an exact retry preserves fresh permission", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const saved = await owner.snapshot();
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const access = owner.forOwnerSession(session.token);
    const intent = registration();
    const grant = await access.register(intent);
    await owner.restore("restore-owner", saved);
    await expect(access.environments()).rejects.toThrow();
    await expect(access.register(intent)).rejects.toThrow();
    await owner.reconcile({
      requestId: "current-owner",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    const fresh = await owner.completeLogin(await fixture.intent(owner, accountId));
    const freshAccess = owner.forOwnerSession(fresh.token);
    expect((await freshAccess.register(intent)).token).toBeNull();
    await owner.restore("restore-owner", saved);
    const currentGrant = await freshAccess.register({ ...intent, requestId: "fresh-registration" });
    expect(await owner.authorize(currentGrant.token!, currentGrant.workbenchId)).not.toBeNull();
    expect(await owner.authorize(grant.token!, grant.workbenchId)).toBeNull();
    await expect(access.environments()).rejects.toThrow();
  } finally {
    await owner.close();
  }
});
