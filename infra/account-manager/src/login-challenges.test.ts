import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { provisionAccount } from "./authority.fixture";
import { createLoginFixture } from "./google-login.fixture";
import * as implementation from "./index";

const fixture = createLoginFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("browser binding and current ownership protect one-time concurrent completion", async () => {
  const owner = fixture.owner();
  const peer = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const otherId = await provisionAccount(owner);
    const intent = await fixture.intent(owner, accountId);
    expect(await owner.loginChallenge(intent.state, "another-browser")).toBeNull();
    await expect(owner.completeLogin({ ...intent, binding: "another-browser" })).rejects.toThrow();
    await expect(owner.completeLogin({ ...intent, accountId: otherId })).rejects.toThrow();
    expect(await owner.loginChallenge(intent.state, intent.binding)).not.toBeNull();
    const results = await Promise.allSettled([owner.completeLogin(intent), peer.completeLogin(intent)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const winner = results.find((result) => result.status === "fulfilled");
    if (winner?.status !== "fulfilled") throw new Error("No login completion succeeded");
    expect(await peer.authorizeSession(winner.value.token)).toEqual({ accountId });
    await expect(owner.completeLogin(intent)).rejects.toThrow();
    expect(await owner.loginChallenge(intent.state, intent.binding)).toBeNull();
  } finally {
    await Promise.all([owner.close(), peer.close()]);
  }
});

test("login challenges and owner sessions expire against database time", async () => {
  const owner = fixture.owner();
  const sql = new SQL(fixture.databaseUrl);
  try {
    const accountId = await provisionAccount(owner);
    const past = new Date(Date.now() - 1000).toISOString();
    await expect(owner.beginLogin({ expiresAt: past })).rejects.toThrow();
    const intent = await fixture.intent(owner, accountId);
    await expect(owner.completeLogin({ ...intent, expiresAt: past })).rejects.toThrow();
    const expiry = new Date(Date.now() + 1000).toISOString();
    const session = await owner.completeLogin({ ...intent, expiresAt: expiry });
    const challenge = await owner.beginLogin({ expiresAt: expiry });
    while ((await sql`SELECT clock_timestamp() < ${expiry}::timestamptz AS waiting`)[0].waiting) await Bun.sleep(10);
    expect(await owner.authorizeSession(session.token)).toBeNull();
    expect(await owner.loginChallenge(challenge.state, challenge.binding)).toBeNull();
    await expect(
      owner.completeLogin({ ...intent, state: challenge.state, binding: challenge.binding }),
    ).rejects.toThrow();
  } finally {
    await Promise.all([owner.close(), sql.close()]);
  }
});

test("private login rows contain no plaintext bearer secrets and digests cannot authenticate", async () => {
  const owner = fixture.owner();
  const sql = new SQL(fixture.databaseUrl);
  try {
    const accountId = await provisionAccount(owner);
    const pending = await fixture.intent(owner, accountId);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const sessions = await sql`SELECT * FROM manager_owner_sessions WHERE "accountId" = ${accountId}`;
    const challenges = await sql`SELECT * FROM manager_login_challenges`;
    const stored = JSON.stringify({ sessions, challenges });
    for (const secret of [pending.state, pending.binding, session.token]) expect(stored).not.toContain(secret);
    expect(await owner.authorizeSession(sessions[0].digest)).toBeNull();
    expect(await owner.loginChallenge(challenges[0].stateDigest, pending.binding)).toBeNull();
  } finally {
    await Promise.all([owner.close(), sql.close()]);
  }
});
