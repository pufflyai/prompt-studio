import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { user } from "../src/auth-schema";
import { createAuthorityFixture, deviceProfile } from "../src/authority.fixture";
import * as implementation from "../src/index";
import { createAuthenticationFixture } from "../src/manager-authentication.fixture";
import { runAccountFeature } from "./account-feature";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("the operator grants and revokes relay by verified Google email after the first device login", async () => {
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const email = `${crypto.randomUUID()}@fixture.test`;
  const command = (action: string, address = email) =>
    runAccountFeature([action, "--email", address, "--feature", "relay"], fixture.databaseUrl);
  try {
    const session = await authentication.login(crypto.randomUUID(), email);
    // A Google session alone is not yet a registered product account.
    await expect(command("grant")).rejects.toThrow("verified Google email");
    const login = await authentication.auth.loginDevice(session.headers, deviceProfile());
    const access = authentication.auth.devices;
    expect(await access.account(login.token)).toEqual({ features: { relay: false } });
    await expect(access.addWorkbench(login.token, "cloud-project")).rejects.toThrow();

    for (let repeat = 0; repeat < 2; repeat++) {
      const grant = await command("grant");
      expect(grant).toEqual({ accountId: login.accountId, feature: "relay", enabled: true });
    }
    await access.addWorkbench(login.token, "cloud-project");
    const keys = await access.keys(login.token, "cloud-project");
    expect(keys?.project).toHaveLength(1);
    expect(await access.workbenches(login.token)).toEqual([{ workbenchId: "cloud-project" }]);
    const issued = await authentication.auth.renew(login.token, "cloud-project");
    const verify = implementation.createEnvironmentAccessVerifier({
      issuer: authentication.config.origin,
      audience: authentication.config.audience,
      jwks: await authentication.auth.jwks(),
    });
    const peer = createAuthenticationFixture(fixture.databaseUrl);
    try {
      expect((await peer.auth.devices.account(login.token)).features.relay).toBe(true);
      expect((await command("revoke")).enabled).toBe(false);
      expect((await command("revoke")).enabled).toBe(false);
      expect((await peer.auth.devices.account(login.token)).features.relay).toBe(false);
      expect(await peer.auth.devices.workbenches(login.token)).toEqual([]);
      expect(await peer.auth.devices.keys(login.token, "cloud-project")).toBeNull();
      await expect(peer.auth.devices.addWorkbench(login.token, "another-project")).rejects.toThrow();
      await expect(peer.auth.renew(login.token, "cloud-project")).rejects.toThrow();
      expect(await verify(issued.token)).toMatchObject({ accountId: login.accountId });
      expect((await peer.auth.devices.devices(login.token)).devices).toHaveLength(1);
      expect((await command("grant", email.toUpperCase())).enabled).toBe(true);
      expect(await access.keys(login.token, "cloud-project")).toEqual(keys);
    } finally {
      await peer.close();
    }

    await expect(command("grant", "unknown@fixture.test")).rejects.toThrow("verified Google email");
    await authentication.connection.db.update(user).set({ emailVerified: false }).where(eq(user.email, email));
    await expect(command("grant")).rejects.toThrow("verified Google email");
  } finally {
    await authentication.close();
  }
});
