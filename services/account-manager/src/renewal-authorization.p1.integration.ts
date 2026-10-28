import { afterAll, beforeAll, expect, test } from "bun:test";
import { createLocalJWKSet, jwtVerify } from "jose";
import { Pool } from "pg";
import { connectDevice, createAuthorityFixture, deviceProfile, provisionAccount } from "./authority.fixture";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";
import { EnvironmentAccessDenied, EnvironmentAccessFailure } from "./renewal-errors";

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

for (const change of ["remove", "replace"] as const) {
  test(`a device ${change}d while signing cannot receive prepared access`, async () => {
    const manager = fixture.owner();
    const auth = implementation.createManagerAuthentication(authenticationConfig(fixture.databaseUrl));
    const control = new Pool({ connectionString: fixture.databaseUrl, max: 2 });
    const holder = await control.connect();
    const pending: Promise<unknown>[] = [];
    try {
      const accountId = await provisionAccount(manager);
      const device = await connectDevice(manager, accountId);
      await auth.jwks();
      await holder.query("BEGIN");
      await holder.query("LOCK TABLE auth_jwks IN ACCESS EXCLUSIVE MODE");
      const renewing = auth.renew(device.token, device.workbenchId).catch((error: unknown) => error);
      pending.push(renewing);
      await waitFor(async () => {
        const { rows } = await control.query(
          "SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
          ['select %from "auth_jwks"%'],
        );
        return rows[0].count === 1;
      });
      const changing =
        change === "remove"
          ? manager.removeDevice({ accountId, deviceId: device.deviceId })
          : manager.registerDevice({ accountId, ...deviceProfile(device.deviceId) });
      pending.push(changing);
      void changing.catch(() => {});
      const changed = await Promise.race([changing.then(() => true), Bun.sleep(1000).then(() => false)]);
      expect(changed).toBe(true);
      await holder.query("ROLLBACK");
      expect(await renewing).toBeInstanceOf(EnvironmentAccessDenied);
    } finally {
      await holder.query("ROLLBACK");
      await Promise.allSettled(pending);
      holder.release();
      await Promise.all([auth.close(), manager.close(), control.end()]);
    }
  });
}

test("renewal never delivers expired access after waiting for authority", async () => {
  const manager = fixture.owner();
  const auth = implementation.createManagerAuthentication({
    ...authenticationConfig(fixture.databaseUrl),
    accessLifetimeSeconds: 1,
  });
  const control = new Pool({ connectionString: fixture.databaseUrl, max: 2 });
  const holder = await control.connect();
  let renewing: Promise<unknown> | undefined;
  try {
    const accountId = await provisionAccount(manager);
    const device = await connectDevice(manager, accountId);
    const keys = createLocalJWKSet(await auth.jwks());
    await holder.query("BEGIN");
    await holder.query('SELECT 1 FROM manager_devices WHERE "accountId"=$1 AND id=$2 FOR UPDATE', [
      accountId,
      device.deviceId,
    ]);
    renewing = auth.renew(device.token, device.workbenchId).catch((error: unknown) => error);
    await waitFor(async () => {
      const { rows } = await control.query(
        "SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",
        ['update "manager_devices"%'],
      );
      return rows[0].count === 1;
    });
    await Bun.sleep(1100);
    await holder.query("ROLLBACK");
    const result = await renewing;
    if (result instanceof Error) {
      expect(result).toBeInstanceOf(EnvironmentAccessFailure);
      expect((result as EnvironmentAccessFailure).category).toBe("signing");
    } else {
      const access = result as { token: string };
      const { payload } = await jwtVerify(access.token, keys, {
        issuer: "https://auth.fixture.test",
        audience: "https://relay.fixture.test",
      });
      expect(payload.exp! * 1000).toBeGreaterThan(Date.now());
    }
  } finally {
    await holder.query("ROLLBACK");
    await renewing;
    holder.release();
    await Promise.all([auth.close(), manager.close(), control.end()]);
  }
});

test("a failed authorization commit withholds prepared access", async () => {
  const manager = fixture.owner();
  const auth = implementation.createManagerAuthentication(authenticationConfig(fixture.databaseUrl));
  const control = new Pool({ connectionString: fixture.databaseUrl, max: 1 });
  try {
    const accountId = await provisionAccount(manager);
    const device = await connectDevice(manager, accountId);
    await auth.jwks();
    await control.query(
      "CREATE FUNCTION fail_presence_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Owned commit failure fixture'; END $$",
    );
    await control.query(
      "CREATE CONSTRAINT TRIGGER fail_presence_commit AFTER UPDATE ON manager_devices DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_presence_commit()",
    );
    const failure = await auth.renew(device.token, device.workbenchId).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(EnvironmentAccessFailure);
    expect((failure as EnvironmentAccessFailure).category).toBe("database");
  } finally {
    await control.query("DROP TRIGGER IF EXISTS fail_presence_commit ON manager_devices");
    await control.query("DROP FUNCTION IF EXISTS fail_presence_commit()");
    await Promise.all([auth.close(), manager.close(), control.end()]);
  }
});
