import { afterAll, beforeAll, expect, test } from "bun:test";
import { provisionAccount } from "./authority.fixture";
import { createLoginFixture } from "./google-login.fixture";
import * as implementation from "./index";

const fixture = createLoginFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("an owner session registers and lists durable environment authority in its account", async () => {
  const owner = fixture.owner();
  const reopened = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const access = owner.forOwnerSession(session.token);
    const intent = {
      requestId: "owner-register",
      workbenchId: "workbench",
      environmentId: "laptop",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const grant = await access.register(intent);
    expect(grant.accountId).toBe(accountId);
    expect(grant.token).toBeString();
    await owner.close();
    expect(await reopened.authorize(grant.token!, intent.workbenchId)).toEqual({
      accountId,
      workbenchId: intent.workbenchId,
      environmentId: intent.environmentId,
    });
    const listing = await reopened.forOwnerSession(session.token).environments();
    expect(listing).toEqual([
      {
        id: grant.id,
        accountId,
        workbenchId: intent.workbenchId,
        environmentId: intent.environmentId,
        expiresAt: intent.expiresAt,
        revokedAt: null,
      },
    ]);
  } finally {
    await Promise.all([owner.close(), reopened.close()]);
  }
});

test("fresh owner sessions retry the same domain intent without reissuing plaintext", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const first = await owner.completeLogin(await fixture.intent(owner, accountId));
    const intent = {
      requestId: "uncertain-registration",
      workbenchId: "workbench",
      environmentId: "laptop",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    await expect(owner.forOwnerSession("invalid-session").register(intent)).rejects.toThrow();
    const access = owner.forOwnerSession(first.token);
    const grant = await access.register(intent);
    expect(grant.token).toBeString();
    expect(await access.register(intent)).toEqual({ ...grant, token: null });
    await owner.logout(first.token);
    await expect(access.register(intent)).rejects.toThrow();
    const fresh = await owner.completeLogin(await fixture.intent(owner, accountId));
    expect(await owner.forOwnerSession(fresh.token).register(intent)).toEqual({ ...grant, token: null });
    await expect(
      owner.forOwnerSession(fresh.token).register({ ...intent, environmentId: "changed-intent" }),
    ).rejects.toThrow();
    const snapshot = JSON.stringify(await owner.snapshot());
    for (const secret of [first.token, fresh.token, grant.token!]) expect(snapshot).not.toContain(secret);
  } finally {
    await owner.close();
  }
});

test("owner replacement and revocation stay isolated across accounts with overlapping identities", async () => {
  const owner = fixture.owner();
  const peer = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const otherId = await provisionAccount(owner);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const other = await owner.completeLogin(await fixture.intent(owner, otherId));
    const access = owner.forOwnerSession(session.token);
    const otherAccess = peer.forOwnerSession(other.token);
    const intent = {
      requestId: "shared-request",
      workbenchId: "workbench",
      environmentId: "laptop",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const original = await access.register(intent);
    const unaffected = await otherAccess.register(intent);
    const secondWorkbench = await access.register({ ...intent, requestId: "another", workbenchId: "another" });
    const replacement = { ...intent, requestId: "replace", replacesId: original.id };
    await expect(otherAccess.replace({ ...replacement, requestId: "cross-account-replace" })).rejects.toThrow();
    const competing = await Promise.allSettled([
      access.replace(replacement),
      peer.forOwnerSession(session.token).replace({ ...replacement, requestId: "competing" }),
    ]);
    expect(competing.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(competing.filter((result) => result.status === "rejected")).toHaveLength(1);
    const winner = competing.find((result) => result.status === "fulfilled");
    if (winner?.status !== "fulfilled") throw new Error("No owner replacement succeeded");
    const acceptedIntent =
      competing[0].status === "fulfilled" ? replacement : { ...replacement, requestId: "competing" };
    expect(await access.replace(acceptedIntent)).toEqual({ ...winner.value, token: null });
    expect(await owner.authorize(original.token!, original.workbenchId)).toBeNull();
    expect(await owner.authorize(winner.value.token!, winner.value.workbenchId)).not.toBeNull();
    const revoke = { requestId: "revoke", environmentId: intent.environmentId };
    await access.revoke(revoke);
    await access.revoke(revoke);
    expect(await owner.authorize(winner.value.token!, winner.value.workbenchId)).toBeNull();
    expect(await owner.authorize(secondWorkbench.token!, secondWorkbench.workbenchId)).toBeNull();
    expect(await peer.authorize(unaffected.token!, unaffected.workbenchId)).toEqual({
      accountId: otherId,
      workbenchId: unaffected.workbenchId,
      environmentId: unaffected.environmentId,
    });
    expect((await otherAccess.environments()).map((grant) => grant.id)).toEqual([unaffected.id]);
    expect((await access.environments()).every((grant) => grant.accountId === accountId)).toBe(true);
  } finally {
    await Promise.all([owner.close(), peer.close()]);
  }
});
