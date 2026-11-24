import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("two devices of one person can open a team project without changing the personal account", async () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const { auth, config } = authentication;
  const handler = implementation.createManagerHandler(auth, config.origin);
  const request = (token: string, path: string, body?: unknown) =>
    handler(
      new Request(config.origin + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );

  try {
    const person = await authentication.login(crypto.randomUUID());
    const first = await auth.loginDevice(person.headers, deviceProfile());
    const second = await auth.loginDevice(person.headers, deviceProfile());
    const visitor = await authentication.login(crypto.randomUUID());
    const other = await auth.loginDevice(visitor.headers, deviceProfile());
    expect(second.accountId).toBe(first.accountId);

    const created = await request(first.token, "/v1/teams", { name: "Studio Team" });
    expect(created.status).toBe(201);
    const team = await created.json();
    expect(team).toMatchObject({ name: "Studio Team", role: "owner", features: { relay: false } });
    expect(await (await request(second.token, "/v1/teams")).json()).toEqual([team]);
    expect(await (await request(other.token, "/v1/teams")).json()).toEqual([]);

    const project = "team-cloud-project";
    const scope = `?accountId=${team.accountId}`;
    const access = { accountId: team.accountId, workbenchId: project };
    expect((await request(first.token, `/v1/workbenches/${project}${scope}`, {})).status).toBe(403);
    await manager.setFeature({ accountId: team.accountId, feature: "relay", enabled: true });
    expect((await request(first.token, `/v1/workbenches/${project}${scope}`, {})).status).toBe(200);
    expect(await (await request(second.token, `/v1/workbenches${scope}`)).json()).toEqual([{ workbenchId: project }]);
    expect(await (await request(second.token, "/v1/workbenches")).json()).toEqual([]);
    expect((await request(other.token, `/v1/workbenches${scope}`)).status).toBe(401);

    const keyPath = `/v1/workbenches/${project}/keys${scope}`;
    const keys = await (await request(first.token, keyPath)).json();
    expect(keys).toMatchObject({ project: [{ generation: 1 }], personal: [{ generation: 1 }] });
    expect(await (await request(second.token, keyPath)).json()).toEqual(keys);
    expect((await request(other.token, keyPath)).status).toBe(401);
    const issued = await request(second.token, "/v1/environment-access", access);
    expect(issued.status).toBe(200);
    const verifier = implementation.createEnvironmentAccessVerifier({
      issuer: config.origin,
      audience: config.audience,
      jwks: await auth.jwks(),
    });
    expect(await verifier((await issued.json()).token)).toMatchObject({
      ...access,
      userId: first.accountId,
      environmentId: second.deviceId,
    });

    const projectPath = `/v1/workbenches/${project}`;
    expect((await request(first.token, `${projectPath}/remove${scope}`, {})).status).toBe(200);
    await request(first.token, `/v1/devices/${second.deviceId}/remove`, {});
    expect((await request(second.token, "/v1/environment-access", access)).status).toBe(401);
    expect((await request(first.token, `${projectPath}${scope}`, {})).status).toBe(200);
    expect(await (await request(first.token, keyPath)).json()).toMatchObject({
      project: [{ generation: 1 }, { generation: 2 }],
      personal: [{ generation: 1 }, { generation: 2 }],
    });
    const snapshot = await manager.snapshot();
    expect(snapshot).toMatchObject({
      teams: [{ accountId: team.accountId, name: "Studio Team" }],
      teamMembers: [{ accountId: team.accountId, userId: first.accountId, role: "owner" }],
      projectMembers: [{ ...access, userId: first.accountId }],
    });
    await expect(
      manager.reconcile({
        requestId: "replace-team-user",
        accountId: first.accountId,
        owner: { issuer: "https://accounts.google.com", subject: crypto.randomUUID() },
        state: "active",
      }),
    ).rejects.toThrow("must keep their verified Google identity");
    const former = snapshot.accounts.map((row) =>
      row.id === first.accountId ? { ...row, ownerSubject: crypto.randomUUID() } : row,
    );
    await expect(manager.restore("mismatched-team-user", { ...snapshot, accounts: former })).rejects.toThrow(
      "conflicts with a verified team user",
    );

    await manager.setFeature({ accountId: team.accountId, feature: "relay", enabled: false });
    expect((await request(first.token, keyPath)).status).toBe(404);
    expect((await request(first.token, "/v1/environment-access", access)).status).toBe(401);
    expect((await request(first.token, "/v1/teams")).status).toBe(200);

    await manager.restore("restore-team-authority", snapshot);
    expect((await request(first.token, "/v1/teams")).status).toBe(401);
    await manager.reconcile({
      requestId: "restore-team-user",
      accountId: first.accountId,
      owner: { issuer: "https://accounts.google.com", subject: person.subject },
      state: "active",
    });
    const returned = await manager.registerDevice({ accountId: first.accountId, ...deviceProfile() });
    expect(await (await request(returned.token, "/v1/teams")).json()).toEqual([]);
    await manager.reconcile({ requestId: "restore-team-account", accountId: team.accountId, state: "active" });
    await manager.setFeature({ accountId: team.accountId, feature: "relay", enabled: true });
    expect(await (await request(returned.token, keyPath)).json()).toMatchObject({
      project: [{ generation: 1 }, { generation: 2 }],
      personal: [{ generation: 1 }, { generation: 2 }],
    });
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});
