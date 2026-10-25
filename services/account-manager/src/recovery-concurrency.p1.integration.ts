import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
import { Client } from "pg";
import { connectDevice, createAuthorityFixture, deviceProfile, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const waitForAuthorityLock = async (sql: SQL, mode: string, granted: boolean) => {
  while (true) {
    const [row] = await sql`SELECT count(*)::integer AS count FROM pg_locks
      WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND locktype = 'advisory' AND classid = 0 AND objid = 0 AND mode = ${mode} AND granted = ${granted}`;
    if (row.count > 0) return;
    await Bun.sleep(10);
  }
};

test("restore waits for an in-flight login and removes its device atomically", async () => {
  const owner = fixture.owner();
  const holder = new Client({ connectionString: fixture.databaseUrl });
  const sql = new SQL(fixture.databaseUrl);
  let issuing: ReturnType<typeof owner.registerDevice> | undefined;
  let restoring: ReturnType<typeof owner.restore> | undefined;
  try {
    const accountId = await provisionAccount(owner);
    await owner.addWorkbench({ accountId, workbenchId: "workbench" });
    const snapshot = await owner.snapshot();
    await holder.connect();
    await holder.query("BEGIN");
    await holder.query("SELECT pg_advisory_xact_lock(1, hashtext($1))", [accountId]);
    issuing = owner.registerDevice({ accountId, ...deviceProfile() });
    await waitForAuthorityLock(sql, "ShareLock", true);
    restoring = owner.restore("restore-after-issuance", snapshot);
    await waitForAuthorityLock(sql, "ExclusiveLock", false);
    await holder.query("COMMIT");
    const grant = await issuing;
    await restoring;
    expect(await owner.authorize(grant.token, "workbench")).toBeNull();
    expect(await owner.devices(accountId)).toEqual([]);
    expect((await owner.snapshot()).accounts.find((row) => row.id === accountId)?.state).toBe("disabled");
  } finally {
    await holder.query("ROLLBACK").catch(() => {});
    await Promise.allSettled([issuing, restoring]);
    await Promise.all([holder.end(), sql.close(), owner.close()]);
  }
});

test("a login waits for restore and observes the restored disabled account", async () => {
  const owner = fixture.owner();
  const holder = new Client({ connectionString: fixture.databaseUrl });
  const sql = new SQL(fixture.databaseUrl);
  let restoring: ReturnType<typeof owner.restore> | undefined;
  let issuing: Promise<unknown> | undefined;
  try {
    const accountId = await provisionAccount(owner);
    const grant = await connectDevice(owner, accountId);
    const snapshot = await owner.snapshot();
    await holder.connect();
    await holder.query("BEGIN");
    await holder.query("LOCK TABLE manager_devices IN ACCESS EXCLUSIVE MODE");
    restoring = owner.restore("restore-before-issuance", snapshot);
    await waitForAuthorityLock(sql, "ExclusiveLock", true);
    issuing = owner.registerDevice({ accountId, ...deviceProfile() }).then(
      () => null,
      (error: Error) => error.message,
    );
    await waitForAuthorityLock(sql, "ShareLock", false);
    await holder.query("COMMIT");
    await restoring;
    expect(await issuing).toContain("Device access");
    expect(await owner.authorize(grant.token, grant.workbenchId)).toBeNull();
    expect(await owner.devices(accountId)).toEqual([]);
  } finally {
    await holder.query("ROLLBACK").catch(() => {});
    await Promise.allSettled([restoring, issuing]);
    await Promise.all([holder.end(), sql.close(), owner.close()]);
  }
});
