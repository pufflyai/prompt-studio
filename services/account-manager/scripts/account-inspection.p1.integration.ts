import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, deviceProfile } from "../src/authority.fixture";
import * as implementation from "../src/index";
import { createAuthenticationFixture } from "../src/manager-authentication.fixture";
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

    const byEmail = await runAccountInspection(["--email", email.toUpperCase()], fixture.databaseUrl);
    const byId = await runAccountInspection(["--account", login.accountId], fixture.databaseUrl);
    expect(byEmail).toEqual(byId);
    expect(byId).toMatchObject({
      accountId: login.accountId,
      state: "active",
      features: { relay: true },
      projects: [
        { projectId: "made-local", syncing: false, keyGenerations: 1 },
        { projectId: "syncing-project", syncing: true, keyGenerations: 0 },
      ],
    });
    expect(byId.devices).toHaveLength(1);
    expect(byId.devices[0]).toMatchObject({ id: login.deviceId, removedAt: null });
    const text = JSON.stringify(byId);
    expect(text).not.toContain(login.token);
    expect(text).not.toContain("secret");
    expect(text).not.toContain("digest");

    await expect(runAccountInspection([], fixture.databaseUrl)).rejects.toThrow();
    await expect(runAccountInspection(["--account", "no-such-account"], fixture.databaseUrl)).rejects.toThrow(
      "No account",
    );
  } finally {
    await authentication.close();
  }
});
