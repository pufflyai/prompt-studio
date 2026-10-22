import { expect, test } from "bun:test";
import { SQL } from "bun";
import { grantServiceAccess } from "./database-migration";

const adminUrl = process.env.MANAGER_TEST_ADMIN_URL!;
const address = (database: string, login?: string) => {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  if (login) {
    url.username = login;
    url.password = `${login}-test-only`;
  }
  return url.href;
};
const connects = async (database: string, login: string) => {
  const sql = new SQL(address(database, login));
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.close();
  }
};

test("on a shared server, a migration lets only its service's login reach its database", async () => {
  const admin = new SQL(adminUrl);
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const relay = `relay_${suffix}`;
  const manager = `manager_${suffix}`;
  try {
    for (const login of [relay, manager]) {
      await admin.unsafe(`CREATE ROLE "${login}" LOGIN PASSWORD '${login}-test-only'`);
      // A hosted server's admin login creates and owns every database, as on DigitalOcean.
      await admin.unsafe(`CREATE DATABASE "${login}"`);
      await grantServiceAccess(address(login), login);
    }
    expect(await connects(manager, manager)).toBe(true);
    expect(await connects(relay, relay)).toBe(true);
    expect(await connects(manager, relay)).toBe(false);
    expect(await connects(relay, manager)).toBe(false);
  } finally {
    for (const login of [relay, manager]) {
      await admin.unsafe(`DROP DATABASE IF EXISTS "${login}" WITH (FORCE)`);
      await admin.unsafe(`DROP ROLE IF EXISTS "${login}"`);
    }
    await admin.close();
  }
});
