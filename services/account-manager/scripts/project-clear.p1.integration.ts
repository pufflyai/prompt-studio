import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, deviceProfile } from "../src/authority.fixture";
import * as implementation from "../src/index";
import { createAuthenticationFixture } from "../src/manager-authentication.fixture";
import { runAccountFeature } from "./account-feature";
import { runManagerProjectClear } from "./project-clear";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("an operator removes a local project's keys, so it syncs again with new ones", async () => {
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const email = `${crypto.randomUUID()}@fixture.test`;
  const otherEmail = `${crypto.randomUUID()}@fixture.test`;
  try {
    const session = await authentication.login(crypto.randomUUID(), email);
    const login = await authentication.auth.loginDevice(session.headers, deviceProfile());
    const other = await authentication.auth.loginDevice(
      (await authentication.login(crypto.randomUUID(), otherEmail)).headers,
      deviceProfile(),
    );
    await runAccountFeature(["grant", "--email", email, "--feature", "relay"], fixture.databaseUrl);
    await runAccountFeature(["grant", "--email", otherEmail, "--feature", "relay"], fixture.databaseUrl);
    const access = authentication.auth.devices;
    for (const [token, project] of [
      [login.token, "kept"],
      [login.token, "cleared"],
      [other.token, "cleared"],
    ] as const) {
      await access.addWorkbench(token, project);
      await access.keys(token, project);
    }
    const old = await access.keys(login.token, "cleared");
    const kept = await access.keys(login.token, "kept");
    const foreign = await access.keys(other.token, "cleared");
    const run = (project: string, ...rest: string[]) =>
      runManagerProjectClear(["--account", login.accountId, "--project", project, ...rest], fixture.databaseUrl);

    await expect(run("kept", "--confirm", "kept")).rejects.toThrow("The project still syncs");
    await expect(run("cleared", "--confirm", "kept")).rejects.toThrow("--confirm must repeat the project ID");
    await access.removeWorkbench(login.token, "cleared");
    const keys: { space: "personal" | "project"; generations: number }[] = [
      { space: "personal", generations: 1 },
      { space: "project", generations: 1 },
    ];
    expect(await run("cleared")).toEqual({
      accountId: login.accountId,
      projectId: "cleared",
      syncing: false,
      keys,
      executed: false,
    });
    expect(await run("cleared", "--confirm", "cleared")).toMatchObject({ keys, executed: true });
    expect(await run("cleared")).toMatchObject({ keys: [], executed: false });

    // Only that project of that account lost its keys.
    expect(await access.keys(login.token, "kept")).toEqual(kept);
    expect(await access.keys(other.token, "cleared")).toEqual(foreign);
    await access.addWorkbench(login.token, "cleared");
    const fresh = await access.keys(login.token, "cleared");
    expect(fresh?.project.map((key) => key.generation)).toEqual([1]);
    expect(fresh?.project[0]?.secret).not.toBe(old?.project[0]?.secret);
    expect(fresh?.personal[0]?.secret).not.toBe(old?.personal[0]?.secret);
  } finally {
    await authentication.close();
  }
});
