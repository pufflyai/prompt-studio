import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import { startEnvironmentAuthority } from "./environment-authority.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

for (const action of ["replace", "revoke", "disable", "reconcile"] as const) {
  test(`HTTP authority observes current ${action} while another account stays allowed`, async () => {
    const manager = fixture.owner();
    const boundary = startEnvironmentAuthority(implementation, manager);
    try {
      const accountId = await provisionAccount(manager);
      const other = await provisionAccount(manager);
      const intent = registration(accountId);
      const grant = await manager.register(intent);
      const unrelated = await manager.register(registration(other));
      expect(await boundary.client.authorize(grant.token!, intent.workbenchId)).not.toBeNull();
      if (action === "replace") {
        const replacement = await manager.replace({ ...registration(accountId), replacesId: grant.id });
        expect(await boundary.client.authorize(replacement.token!, intent.workbenchId)).not.toBeNull();
      } else if (action === "revoke") {
        await manager.revoke({ accountId, requestId: action, environmentId: intent.environmentId });
      } else if (action === "disable") {
        await manager.disable({ accountId, requestId: action });
      } else {
        await manager.reconcile({
          accountId,
          requestId: action,
          state: "active",
          owner: { issuer: "https://accounts.google.com", subject: accountId },
        });
      }
      expect(await boundary.client.authorize(grant.token!, intent.workbenchId)).toBeNull();
      expect(await boundary.client.authorize(unrelated.token!, intent.workbenchId)).toEqual({
        accountId: other,
        workbenchId: intent.workbenchId,
        environmentId: intent.environmentId,
      });
    } finally {
      await boundary.close();
      await manager.close();
    }
  });
}

test("HTTP authority uses database expiry rather than a previous successful response", async () => {
  const manager = fixture.owner();
  const boundary = startEnvironmentAuthority(implementation, manager);
  try {
    const accountId = await provisionAccount(manager);
    const intent = { ...registration(accountId), expiresAt: new Date(Date.now() + 1000).toISOString() };
    const grant = await manager.register(intent);
    expect(await boundary.client.authorize(grant.token!, intent.workbenchId)).not.toBeNull();
    await Bun.sleep(Math.max(0, Date.parse(intent.expiresAt) - Date.now() + 1));
    expect(await boundary.client.authorize(grant.token!, intent.workbenchId)).toBeNull();
  } finally {
    await boundary.close();
    await manager.close();
  }
});

test("manager restore denies old HTTP grants and an exact retry preserves fresh authority", async () => {
  const manager = fixture.owner();
  const boundary = startEnvironmentAuthority(implementation, manager);
  try {
    const accountId = await provisionAccount(manager);
    const intent = registration(accountId);
    const grant = await manager.register(intent);
    const snapshot = await manager.snapshot();
    expect(await boundary.client.authorize(grant.token!, intent.workbenchId)).not.toBeNull();
    await manager.restore("restore", snapshot);
    expect(await boundary.client.authorize(grant.token!, intent.workbenchId)).toBeNull();
    await manager.reconcile({
      accountId,
      requestId: "reestablish",
      state: "active",
      owner: { issuer: "https://accounts.google.com", subject: accountId },
    });
    const fresh = await manager.register(registration(accountId));
    await manager.restore("restore", snapshot);
    expect(await boundary.client.authorize(fresh.token!, intent.workbenchId)).not.toBeNull();
    expect(await boundary.client.authorize(grant.token!, intent.workbenchId)).toBeNull();
  } finally {
    await boundary.close();
    await manager.close();
  }
});
