import { afterAll, beforeAll, expect, test } from "bun:test";
import { provisionAccount } from "./authority.fixture";
import { createLoginFixture } from "./google-login.fixture";
import * as implementation from "./index";

const fixture = createLoginFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("manager restore removes all owner sessions and pending login challenges", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const old = await owner.completeLogin(await fixture.intent(owner, accountId));
    const pending = await fixture.intent(owner, accountId);
    const snapshot = await owner.snapshot();
    for (const secret of [old.token, pending.state, pending.binding])
      expect(JSON.stringify(snapshot)).not.toContain(secret);
    const newer = await owner.completeLogin(await fixture.intent(owner, accountId));
    await owner.restore("restore-owner-login", snapshot);
    expect(await owner.authorizeSession(old.token)).toBeNull();
    expect(await owner.authorizeSession(newer.token)).toBeNull();
    expect(await owner.loginChallenge(pending.state, pending.binding)).toBeNull();
    await expect(owner.completeLogin(await fixture.intent(owner, accountId))).rejects.toThrow();
    await owner.reconcile({
      requestId: "current-owner-after-login-restore",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    const fresh = await owner.completeLogin(await fixture.intent(owner, accountId));
    await owner.restore("restore-owner-login", snapshot);
    expect(await owner.authorizeSession(old.token)).toBeNull();
    expect(await owner.authorizeSession(newer.token)).toBeNull();
    expect(await owner.authorizeSession(fresh.token)).toEqual({ accountId });
  } finally {
    await owner.close();
  }
});

test("a rejected manager restore preserves live owner sessions and pending login", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const pending = await fixture.intent(owner, accountId);
    const nonce = await owner.loginChallenge(pending.state, pending.binding);
    await expect(
      owner.restore("rejected-login-restore", { ...(await owner.snapshot()), version: 2 }),
    ).rejects.toThrow();
    expect(await owner.authorizeSession(session.token)).toEqual({ accountId });
    expect(await owner.loginChallenge(pending.state, pending.binding)).toEqual(nonce);
  } finally {
    await owner.close();
  }
});
