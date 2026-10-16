import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { Client } from "pg";
import { provisionAccount } from "./authority.fixture";
import { createLoginFixture } from "./google-login.fixture";
import * as implementation from "./index";

const fixture = createLoginFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("owner registration rechecks its session after queued ownership reconciliation", async () => {
  const owner = fixture.owner();
  const peer = fixture.owner();
  const holder = new Client({ connectionString: fixture.databaseUrl });
  const sql = new SQL(fixture.databaseUrl);
  let reconciling: ReturnType<typeof owner.reconcile> | undefined;
  let registering: ReturnType<ReturnType<typeof peer.forOwnerSession>["register"]> | undefined;
  try {
    const accountId = await provisionAccount(owner);
    const session = await owner.completeLogin(await fixture.intent(owner, accountId));
    const access = peer.forOwnerSession(session.token);
    const intent = {
      requestId: "queued-owner-registration",
      workbenchId: "workbench",
      environmentId: "laptop",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    await holder.connect();
    await holder.query("BEGIN");
    await holder.query("LOCK TABLE manager_owner_sessions IN SHARE MODE");
    reconciling = owner.reconcile({
      requestId: "changed-owner",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: "new-google-owner" },
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
      if (reconciled) throw new Error("Reconciliation skipped blocked session invalidation");
      await Bun.sleep(10);
    }
    registering = access.register(intent);
    let registered = false;
    void registering.then(
      () => {
        registered = true;
      },
      () => {
        registered = true;
      },
    );
    while (true) {
      const rows = await sql`SELECT count(*)::integer AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query LIKE '%pg_advisory_xact_lock(1,%' AND pid <> pg_backend_pid()`;
      if (rows[0].waiting) break;
      if (registered) throw new Error("Registration did not wait for current account authority");
      await Bun.sleep(10);
    }
    await holder.query("COMMIT");
    await reconciling;
    await expect(registering).rejects.toThrow();
    await owner.reconcile({
      requestId: "current-owner",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    const fresh = await owner.completeLogin(await fixture.intent(owner, accountId));
    expect((await peer.forOwnerSession(fresh.token).register(intent)).token).toBeString();
    await expect(access.environments()).rejects.toThrow();
  } finally {
    await holder.query("ROLLBACK").catch(() => {});
    await Promise.allSettled([reconciling, registering]);
    await Promise.all([holder.end(), sql.close(), owner.close(), peer.close()]);
  }
});
