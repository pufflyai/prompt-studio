import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { Client } from "pg";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("retrying a completed manager restore does not revoke newly established authority", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const snapshot = await owner.snapshot();
    await owner.restore("restore-retry", snapshot);
    await owner.reconcile({
      requestId: "current-authority-after-restore",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    const fresh = await owner.register(registration(accountId));
    await owner.restore("restore-retry", snapshot);
    expect(await owner.authorize(fresh.token!, fresh.workbenchId)).not.toBeNull();
    await expect(
      owner.restore("restore-retry", { version: 1, accounts: [], workbenches: [], requests: [] }),
    ).rejects.toThrow("changed intent");
    expect(await owner.authorize(fresh.token!, fresh.workbenchId)).not.toBeNull();
  } finally {
    await owner.close();
  }
});

test("operator reconciliation cannot carry credentials into changed ownership", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const intent = registration(accountId);
    const grant = await owner.register(intent);
    await owner.reconcile({
      requestId: "current-ownership",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: "current-google-owner" },
      state: "active",
    });
    expect(await owner.authorize(grant.token!, intent.workbenchId)).toBeNull();
    expect((await owner.register(intent)).token).toBeNull();
    const fresh = await owner.register(registration(accountId));
    expect(await owner.authorize(fresh.token!, fresh.workbenchId)).not.toBeNull();
  } finally {
    await owner.close();
  }
});

test("old manager restore invalidates credentials and requires explicit current reconciliation", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const intent = registration(accountId);
    const old = await owner.register(intent);
    const snapshot = await owner.snapshot();
    expect(JSON.stringify(snapshot)).not.toContain(old.token!);
    await owner.revoke({ requestId: "revoke-after-backup", accountId, environmentId: intent.environmentId });
    const newer = await owner.register(registration(accountId));
    await owner.restore("old-manager-state", snapshot);
    expect(await owner.authorize(old.token!, intent.workbenchId)).toBeNull();
    expect(await owner.authorize(newer.token!, newer.workbenchId)).toBeNull();
    expect(await owner.environments(accountId)).toHaveLength(0);
    await expect(owner.register(registration(accountId))).rejects.toThrow("not active");
    const retry = await owner.register(intent);
    expect(retry.token).toBeNull();
    expect(retry.id).toBe(old.id);
    await owner.reconcile({
      requestId: "current-operator-reconciliation",
      accountId,
      owner: { issuer: "https://accounts.google.com", subject: accountId },
      state: "active",
    });
    expect(await owner.authorize(old.token!, intent.workbenchId)).toBeNull();
    const fresh = await owner.register(registration(accountId));
    const reopened = fixture.owner();
    try {
      expect(await reopened.authorize(old.token!, intent.workbenchId)).toBeNull();
      expect(await reopened.authorize(fresh.token!, fresh.workbenchId)).toEqual({
        accountId,
        workbenchId: fresh.workbenchId,
        environmentId: fresh.environmentId,
      });
    } finally {
      await reopened.close();
    }
  } finally {
    await owner.close();
  }
});

test("an invalid manager snapshot leaves live authority intact", async () => {
  const owner = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const grant = await owner.register(registration(accountId));
    const snapshot = await owner.snapshot();
    await expect(owner.restore("unsupported-version", { ...snapshot, version: 2 })).rejects.toThrow();
    expect(await owner.authorize(grant.token!, grant.workbenchId)).not.toBeNull();
    await expect(
      owner.restore("invalid-relationships", {
        ...snapshot,
        workbenches: [...snapshot.workbenches, { accountId: "missing-account", id: "orphan-workbench" }],
      }),
    ).rejects.toThrow();
    expect(await owner.authorize(grant.token!, grant.workbenchId)).not.toBeNull();
  } finally {
    await owner.close();
  }
});

test("a snapshot keeps one authority boundary while another account is provisioned", async () => {
  const owner = fixture.owner();
  const holder = new Client({ connectionString: fixture.databaseUrl });
  const sql = new SQL(fixture.databaseUrl);
  let snapshotting: ReturnType<typeof owner.snapshot> | undefined;
  try {
    await provisionAccount(owner);
    await holder.connect();
    await holder.query("BEGIN");
    await holder.query("LOCK TABLE manager_workbenches IN ACCESS EXCLUSIVE MODE");
    snapshotting = owner.snapshot();
    let settled = false;
    void snapshotting.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    while (true) {
      const waiting = await sql`SELECT count(*)::integer AS count FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query LIKE '%manager_workbenches%' AND pid <> pg_backend_pid()`;
      if (waiting[0].count > 0) break;
      if (settled) throw new Error("Snapshot returned before its blocked read");
      await Bun.sleep(10);
    }
    const later = await provisionAccount(owner);
    await holder.query("COMMIT");
    const snapshot = await snapshotting;
    expect(snapshot.accounts.some((account) => account.id === later)).toBe(false);
    expect(snapshot.requests.some((request) => request.accountId === later)).toBe(false);
    await owner.restore("consistent-snapshot", snapshot);
  } finally {
    await holder.query("ROLLBACK").catch(() => {});
    await snapshotting?.catch(() => {});
    await Promise.all([holder.end(), sql.close(), owner.close()]);
  }
});
