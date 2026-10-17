import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("environment authority survives restart and stays within its account and workbench", async () => {
  const first = fixture.owner();
  const accountId = crypto.randomUUID();
  const workbenchId = "shared-workbench-id";
  const environmentId = "shared-environment-id";
  const grant = await (async () => {
    try {
      await first.provision({
        requestId: "provision",
        accountId,
        owner: { issuer: "https://accounts.google.com", subject: "google-owner" },
      });
      return await first.register({
        requestId: "register",
        accountId,
        workbenchId,
        environmentId,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
    } finally {
      await first.close();
    }
  })();
  expect(grant.token).toBeString();
  const reopened = fixture.owner();
  try {
    expect(await reopened.authorize(grant.token!, workbenchId)).toEqual({ accountId, workbenchId, environmentId });
    expect(await reopened.authorize(grant.token!, "another-workbench")).toBeNull();
    expect(await reopened.authorize("unknown-credential", workbenchId)).toBeNull();
  } finally {
    await reopened.close();
  }
});

test("concurrent registration returns one secret and immutable retry metadata", async () => {
  const first = fixture.owner();
  const second = fixture.owner();
  const sql = new SQL(fixture.databaseUrl);
  try {
    const accountId = await provisionAccount(first);
    const intent = registration(accountId);
    const results = await Promise.all([first.register(intent), second.register(intent)]);
    const delivered = results.filter((result) => result.token !== null);
    expect(delivered).toHaveLength(1);
    expect(results[0].id).toBe(results[1].id);
    const token = delivered[0].token!;
    const retry = await second.register(intent);
    expect(retry.token).toBeNull();
    expect(retry.id).toBe(delivered[0].id);
    await expect(second.register({ ...intent, workbenchId: "changed-workbench" })).rejects.toThrow("changed intent");
    const stored = await sql`SELECT digest FROM manager_credentials WHERE id = ${retry.id}`;
    const receipts = await sql`SELECT result FROM manager_requests WHERE "accountId" = ${accountId}`;
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(JSON.stringify(receipts)).not.toContain(token);
    expect(await second.authorize(stored[0].digest, intent.workbenchId)).toBeNull();
    expect(await second.authorize(token, intent.workbenchId)).toEqual({
      accountId,
      workbenchId: intent.workbenchId,
      environmentId: intent.environmentId,
    });
  } finally {
    await Promise.all([first.close(), second.close(), sql.close()]);
  }
});

test("credential authority ends at its supplied expiry", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const intent = { ...registration(accountId), expiresAt: new Date(Date.now() + 1000).toISOString() };
    const grant = await owner.register(intent);
    expect(await owner.authorize(grant.token!, intent.workbenchId)).not.toBeNull();
    await Bun.sleep(Math.max(0, Date.parse(intent.expiresAt) - Date.now() + 1));
    expect(await owner.authorize(grant.token!, intent.workbenchId)).toBeNull();
    expect((await owner.register(intent)).token).toBeNull();
    await expect(owner.register({ ...intent, requestId: "expired-new-issuance" })).rejects.toThrow("future");
  } finally {
    await owner.close();
  }
});
