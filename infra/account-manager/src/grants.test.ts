import { afterAll, beforeAll, expect, test } from "bun:test";
import { Client } from "pg";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("environment revocation persists without affecting another account with overlapping IDs", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const otherAccount = await provisionAccount(owner);
    const intent = registration(accountId, "register");
    const first = await owner.register(intent);
    const second = await owner.register({ ...registration(accountId), workbenchId: "another-workbench" });
    const other = await owner.register(registration(otherAccount, "register"));
    const revoke = { requestId: "revoke", accountId, environmentId: intent.environmentId };
    await owner.revoke(revoke);
    await owner.revoke(revoke);
    expect(await owner.authorize(first.token!, intent.workbenchId)).toBeNull();
    expect(await owner.authorize(second.token!, second.workbenchId)).toBeNull();
    expect(await owner.authorize(other.token!, other.workbenchId)).toEqual({
      accountId: otherAccount,
      workbenchId: other.workbenchId,
      environmentId: other.environmentId,
    });
    const reopened = fixture.owner();
    try {
      expect(await reopened.authorize(first.token!, intent.workbenchId)).toBeNull();
      expect((await reopened.register(intent)).token).toBeNull();
      const fresh = await reopened.register(registration(accountId));
      expect(await reopened.authorize(fresh.token!, fresh.workbenchId)).not.toBeNull();
      expect(await reopened.authorize(first.token!, intent.workbenchId)).toBeNull();
      expect(
        (await reopened.environments(accountId)).filter((grant) => grant.environmentId === intent.environmentId),
      ).toHaveLength(3);
    } finally {
      await reopened.close();
    }
  } finally {
    await owner.close();
  }
});

test("disabling an account denies current credentials and new issuance after restart", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const intent = registration(accountId);
    const grant = await owner.register(intent);
    const disable = { requestId: "disable", accountId };
    await owner.disable(disable);
    await owner.disable(disable);
    const reopened = fixture.owner();
    try {
      expect(await reopened.authorize(grant.token!, intent.workbenchId)).toBeNull();
      await expect(reopened.register(registration(accountId))).rejects.toThrow("not active");
      expect((await reopened.register(intent)).token).toBeNull();
    } finally {
      await reopened.close();
    }
  } finally {
    await owner.close();
  }
});

test("concurrent credential replacement accepts one immutable proposal and revokes the old secret", async () => {
  const owner = fixture.owner();
  const second = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const old = await owner.register(registration(accountId));
    const firstIntent = { ...registration(accountId), replacesId: old.id };
    const secondIntent = { ...firstIntent, requestId: "competing-replacement" };
    const results = await Promise.allSettled([owner.replace(firstIntent), second.replace(secondIntent)]);
    const accepted = results.filter((result) => result.status === "fulfilled");
    expect(accepted).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const grant = accepted[0].value;
    expect(await owner.authorize(old.token!, old.workbenchId)).toBeNull();
    expect(await owner.authorize(grant.token!, grant.workbenchId)).not.toBeNull();
    const intent = results[0].status === "fulfilled" ? firstIntent : secondIntent;
    const retry = await second.replace(intent);
    expect(retry.id).toBe(grant.id);
    expect(retry.token).toBeNull();
  } finally {
    await Promise.all([owner.close(), second.close()]);
  }
});

test("the ordinary relay role cannot connect to private manager authority", async () => {
  const own = new Client({ connectionString: fixture.relayContentUrl });
  const denied = new Client({ connectionString: fixture.relayUrl });
  try {
    await own.connect();
    expect((await own.query("SELECT current_user")).rowCount).toBe(1);
    await expect(denied.connect()).rejects.toMatchObject({ code: "42501" });
  } finally {
    await Promise.all([own.end(), denied.end()]);
  }
});
