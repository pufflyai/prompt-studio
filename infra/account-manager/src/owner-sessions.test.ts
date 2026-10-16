import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { Client } from "pg";
import { provisionAccount } from "./authority.fixture";
import { createLoginFixture } from "./google-login.fixture";
import * as implementation from "./index";

const fixture = createLoginFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("owner logout is durable and affects only that session", async () => {
  const owner = fixture.owner();
  const reopened = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const otherId = await provisionAccount(owner);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const other = await owner.completeLogin(await fixture.intent(owner, otherId));
    await owner.logout(session.token);
    await owner.logout(session.token);
    await owner.close();
    expect(await reopened.authorizeSession(session.token)).toBeNull();
    expect(await reopened.authorizeSession(other.token)).toEqual({ accountId: otherId });
  } finally {
    await Promise.all([owner.close(), reopened.close()]);
  }
});

test("ownership reconciliation invalidates old owner sessions without affecting another account", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const otherId = await provisionAccount(owner);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const other = await owner.completeLogin(await fixture.intent(owner, otherId));
    await owner.reconcile({
      requestId: "changed-google-owner",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: "new-google-owner" },
      state: "active",
    });
    expect(await owner.authorizeSession(session.token)).toBeNull();
    expect(await owner.authorizeSession(other.token)).toEqual({ accountId: otherId });
  } finally {
    await owner.close();
  }
});

test("account disable cannot leave an owner session that revives after reconciliation", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    await owner.disable({ requestId: "disable-owner", accountId });
    expect(await owner.authorizeSession(session.token)).toBeNull();
    await owner.reconcile({
      requestId: "current-active-owner",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    expect(await owner.authorizeSession(session.token)).toBeNull();
    const fresh = await owner.completeLogin(await fixture.intent(owner, accountId));
    expect(await owner.authorizeSession(fresh.token)).toEqual({ accountId });
  } finally {
    await owner.close();
  }
});

test("login completion waits for current ownership reconciliation before reading permission", async () => {
  const owner = fixture.owner();
  const peer = fixture.owner();
  const holder = new Client({ connectionString: fixture.databaseUrl });
  const sql = new SQL(fixture.databaseUrl);
  let reconciling: ReturnType<typeof owner.reconcile> | undefined;
  let completing: ReturnType<typeof peer.completeLogin> | undefined;
  try {
    const accountId = await provisionAccount(owner);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const intent = await fixture.intent(owner, accountId);
    await holder.connect();
    await holder.query("BEGIN");
    await holder.query("LOCK TABLE manager_owner_sessions IN ACCESS EXCLUSIVE MODE");
    reconciling = owner.reconcile({
      requestId: "concurrent-current-google-owner",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: "new-current-owner" },
      state: "active",
    });
    let reconciled = false;
    void reconciling.then(
      () => {
        reconciled = true;
      },
      () => {
        reconciled = true;
      },
    );
    while (true) {
      const rows = await sql`SELECT count(*)::integer AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query LIKE '%manager_owner_sessions%' AND pid <> pg_backend_pid()`;
      if (rows[0].waiting) break;
      if (reconciled) throw new Error("Reconciliation skipped its blocked session invalidation");
      await Bun.sleep(10);
    }
    completing = peer.completeLogin(intent);
    let completed = false;
    void completing.then(
      () => {
        completed = true;
      },
      () => {
        completed = true;
      },
    );
    while (true) {
      const rows = await sql`SELECT count(*)::integer AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query LIKE '%pg_advisory_xact_lock(1,%' AND pid <> pg_backend_pid()`;
      if (rows[0].waiting) break;
      if (completed) throw new Error("Login did not wait for its current account boundary");
      await Bun.sleep(10);
    }
    await holder.query("COMMIT");
    await reconciling;
    await expect(completing).rejects.toThrow();
    expect(await peer.authorizeSession(session.token)).toBeNull();
  } finally {
    await holder.query("ROLLBACK").catch(() => {});
    await Promise.allSettled([reconciling, completing]);
    await Promise.all([holder.end(), sql.close(), owner.close(), peer.close()]);
  }
});
