import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createAuthorityFixture, deviceProfile } from "../src/authority.fixture";
import * as implementation from "../src/index";
import { createAuthenticationFixture } from "../src/manager-authentication.fixture";
import { devices, spaceKeys } from "../src/schema";
import { runAccountFeature } from "./account-feature";
import { runAccountInspection } from "./account-inspection";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("an operator sees an account's devices and every project it held keys for, without secrets", async () => {
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const email = `${crypto.randomUUID()}@fixture.test`;
  try {
    const session = await authentication.login(crypto.randomUUID(), email);
    const login = await authentication.auth.loginDevice(session.headers, deviceProfile());
    await runAccountFeature(["grant", "--email", email, "--feature", "relay"], fixture.databaseUrl);
    const access = authentication.auth.devices;
    await access.addWorkbench(login.token, "syncing-project");
    await access.addWorkbench(login.token, "made-local");
    await access.keys(login.token, "made-local");
    await access.removeWorkbench(login.token, "made-local");
    // Removing a second device rotates the keys of every project the account holds keys for.
    const second = await authentication.auth.loginDevice(session.headers, deviceProfile());
    await access.keys(second.token, "syncing-project");
    await access.remove(login.token, second.deviceId);

    const byEmail = await runAccountInspection(["--email", email.toUpperCase()], fixture.databaseUrl);
    const byId = await runAccountInspection(["--account", login.accountId], fixture.databaseUrl);
    expect(byEmail).toEqual(byId);
    expect(byId).toMatchObject({
      accountId: login.accountId,
      state: "active",
      features: { relay: true },
      projects: [
        { projectId: "made-local", syncing: false, keyGenerations: 2 },
        { projectId: "syncing-project", syncing: true, keyGenerations: 2 },
      ],
    });
    expect(byId.devices.map(({ id, removedAt }) => ({ id, removed: removedAt !== null }))).toEqual([
      { id: login.deviceId, removed: false },
      { id: second.deviceId, removed: true },
    ]);
    // No credential, signing key or space secret leaves the manager.
    const text = JSON.stringify(byId);
    const stored = [
      ...(await authentication.connection.db
        .select({ digest: devices.digest, signingKey: devices.signingKey })
        .from(devices)
        .where(eq(devices.accountId, login.accountId))),
    ].flatMap((row) => [row.digest, row.signingKey ?? ""]);
    const secrets = await authentication.connection.db
      .select({ secret: spaceKeys.secret })
      .from(spaceKeys)
      .where(eq(spaceKeys.accountId, login.accountId));
    for (const value of [login.token, second.token, ...stored, ...secrets.map((row) => row.secret)])
      if (value) expect(text).not.toContain(value);

    await expect(runAccountInspection([], fixture.databaseUrl)).rejects.toThrow();
    await expect(runAccountInspection(["--account", "no-such-account"], fixture.databaseUrl)).rejects.toThrow(
      "No account",
    );
  } finally {
    await authentication.close();
  }
});
