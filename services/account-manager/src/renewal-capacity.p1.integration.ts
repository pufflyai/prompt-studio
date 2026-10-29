import { afterAll, beforeAll, expect, test } from "bun:test";
import { createLocalJWKSet, jwtVerify } from "jose";
import { Pool } from "pg";
import { connectDevice, createAuthorityFixture, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const waitFor = async (check: () => Promise<boolean>) => {
  const until = Date.now() + 1000;
  while (!(await check())) {
    if (Date.now() >= until) throw new Error("Database coordination did not reach its checkpoint");
    await Bun.sleep(5);
  }
};

test("renewal completes when other account requests occupy the pool", async () => {
  const manager = fixture.owner();
  const auth = implementation.createManagerAuthentication(authenticationConfig(fixture.databaseUrl));
  const control = new Pool({ connectionString: fixture.databaseUrl, max: 2 });
  const holder = await control.connect();
  const pending: Promise<unknown>[] = [];
  try {
    const accountId = await provisionAccount(manager);
    const device = await connectDevice(manager, accountId);
    const keys = createLocalJWKSet(await auth.jwks());
    await holder.query("BEGIN");
    await holder.query('SELECT 1 FROM manager_devices WHERE "accountId"=$1 AND id=$2 FOR UPDATE', [
      accountId,
      device.deviceId,
    ]);
    const renewal = auth.renew(device.token, device.workbenchId);
    pending.push(renewal);
    void renewal.catch(() => {});
    await waitFor(async () => {
      const { rows } = await control.query(
        "SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
        ['update "manager_devices"%'],
      );
      return rows[0].count === 1;
    });
    for (let index = 0; index < 9; index++) {
      const heartbeat = auth.devices.heartbeat(device.token);
      pending.push(heartbeat);
      void heartbeat.catch(() => {});
    }
    await waitFor(async () => {
      const { rows } = await control.query(
        "SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'",
      );
      return rows[0].count === 9;
    });
    const completed = Promise.all(pending).then(
      (value) => ({ kind: "complete" as const, value }),
      (error: unknown) => ({ kind: "error" as const, error }),
    );
    await holder.query("ROLLBACK");
    const result = await Promise.race([completed, Bun.sleep(1000).then(() => ({ kind: "blocked" as const }))]);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") return;
    const access = result.value[0] as { token: string; expiresAt: string };
    const { payload } = await jwtVerify(access.token, keys, {
      issuer: "https://auth.fixture.test",
      audience: "https://relay.fixture.test",
    });
    expect(payload).toMatchObject({ accountId, workbenchId: device.workbenchId, environmentId: device.deviceId });
  } finally {
    await holder.query("ROLLBACK");
    // Release only this fixture's lock waiters if the old renewal leaves the pool blocked.
    await control.query(
      "SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'",
    );
    await Promise.allSettled(pending);
    holder.release();
    await Promise.all([auth.close(), manager.close(), control.end()]);
  }
});
