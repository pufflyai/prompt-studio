import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("assigned members manage their projects without gaining team administration or other projects", async () => {
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const { config } = authentication;
  const auth = implementation.createManagerAuthentication({
    ...config,
    projectDeletionRelayToken: "team-permissions-disposable-relay-token",
  });
  const manager = fixture.owner();
  const recovered = createAuthorityFixture(implementation);
  const completedRecovery = createAuthorityFixture(implementation);
  const handler = implementation.createManagerHandler(auth, config.origin);
  const device = async () => {
    const login = await authentication.login(crypto.randomUUID());
    return auth.loginDevice(login.headers, deviceProfile());
  };
  const request = (token: string, path: string, body?: unknown) =>
    handler(
      new Request(config.origin + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  try {
    const owner = await device();
    const member = await device();
    const peer = await device();
    const { accountId } = await (await request(owner.token, "/v1/teams", { name: "Project permissions" })).json();
    const team = `/v1/teams/${accountId}`;
    const join = async (token: string) => {
      const { code } = await (await request(owner.token, `${team}/invite-codes`, {})).json();
      expect((await request(token, "/v1/team-invitations/accept", { secret: code })).status).toBe(200);
    };
    await join(member.token);
    await join(peer.token);
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
    for (const id of ["assigned", "private"])
      expect((await request(owner.token, `/v1/workbenches/${id}?accountId=${accountId}`, {})).status).toBe(200);
    const grant = (token: string, project: string, userId: string, granted: boolean) =>
      request(token, `${team}/projects/${project}/access`, { userId, granted });
    expect((await grant(owner.token, "assigned", member.accountId, true)).status).toBe(200);
    const projects = await request(member.token, `${team}/projects`);
    expect(projects.status).toBe(200);
    expect(await projects.json()).toEqual([
      { workbenchId: "assigned", userIds: [owner.accountId, member.accountId].sort() },
    ]);
    expect(await (await request(peer.token, `${team}/projects`)).json()).toEqual([]);
    expect((await grant(member.token, "private", peer.accountId, true)).status).toBe(403);
    expect((await grant(member.token, "assigned", peer.accountId, true)).status).toBe(200);
    const [{ grantId }] = await (await request(member.token, `/v1/workbenches?accountId=${accountId}`)).json();
    const renewed = await request(member.token, "/v1/environment-access", {
      accountId,
      workbenchId: "assigned",
      grantId,
    });
    expect(renewed.status).toBe(200);
    expect(await renewed.json()).toMatchObject({ canPublish: true });
    expect((await grant(member.token, "assigned", peer.accountId, false)).status).toBe(200);
    expect(await (await request(peer.token, `/v1/workbenches?accountId=${accountId}`)).json()).toEqual([]);
    expect((await grant(owner.token, "assigned", owner.accountId, false)).status).toBe(200);
    expect(
      (
        await request(owner.token, "/v1/environment-access", {
          accountId,
          workbenchId: "assigned",
          grantId,
        })
      ).status,
    ).toBe(401);
    expect(await (await request(owner.token, `${team}/projects`)).json()).toEqual([
      { workbenchId: "assigned", userIds: [member.accountId] },
      { workbenchId: "private", userIds: [owner.accountId] },
    ]);
    expect((await request(member.token, `${team}/invite-codes`, {})).status).toBe(403);
    expect((await request(member.token, `${team}/members/${owner.accountId}/remove`, {})).status).toBe(403);

    expect((await request(member.token, `/v1/workbenches/assigned/remove?accountId=${accountId}`, {})).status).toBe(
      200,
    );
    expect(
      (await request(owner.token, `/v1/workbenches/assigned?accountId=${accountId}`, { grantSelf: true })).status,
    ).toBe(200);
    expect((await grant(owner.token, "assigned", member.accountId, true)).status).toBe(200);
    const receipt = `/v1/workbenches/assigned/deletion?accountId=${accountId}`;
    expect(
      (await request(peer.token, `/v1/workbenches/private/deletion?accountId=${accountId}`, { confirm: true })).status,
    ).toBe(401);
    const deleted = await request(member.token, receipt, { confirm: true });
    expect(deleted.status).toBe(202);
    const operation = await deleted.json();
    expect(await (await request(member.token, receipt)).json()).toEqual(operation);
    expect(await (await request(member.token, `/v1/project-deletions?accountId=${accountId}`)).json()).toEqual([
      operation,
    ]);
    expect((await request(peer.token, receipt)).status).toBe(401);
    expect(await (await request(peer.token, `/v1/project-deletions?accountId=${accountId}`)).json()).toEqual([]);
    const restarted = implementation.createManagerAuthentication({
      ...config,
      projectDeletionRelayToken: "team-permissions-disposable-relay-token",
    });
    try {
      const restartedHandler = implementation.createManagerHandler(restarted, config.origin);
      expect(
        await (
          await restartedHandler(
            new Request(config.origin + receipt, {
              headers: { authorization: `Bearer ${member.token}` },
            }),
          )
        ).json(),
      ).toEqual(operation);
    } finally {
      await restarted.close();
    }
    const saved = await manager.snapshot();
    expect(saved.deletions?.find((row) => row.accountId === accountId)).toMatchObject({
      requestedBy: member.accountId,
    });
    await recovered.initialize();
    const legacy = {
      ...saved,
      deletions: saved.deletions?.map((row) => {
        const receipt = { ...row };
        delete receipt.requestedBy;
        return receipt;
      }),
    };
    const restore = recovered.owner();
    try {
      await restore.restore("legacy-member-deletion-receipt", legacy);
      await restore.restore("member-deletion-receipt", saved);
      expect((await restore.snapshot()).deletions?.find((row) => row.accountId === accountId)).toMatchObject({
        requestedBy: member.accountId,
      });
    } finally {
      await restore.close();
    }
    await completedRecovery.initialize();
    const complete = completedRecovery.owner();
    try {
      await complete.restore("completed-legacy-receipt", {
        ...legacy,
        deletions: legacy.deletions?.map((row) => ({
          ...row,
          state: "completed" as const,
          completedAt: new Date().toISOString(),
        })),
      });
      await complete.restore("older-receipt-with-requester", saved);
      const replayed = await complete.snapshot();
      expect(replayed.deletions?.find((row) => row.accountId === accountId)).toMatchObject({
        requestedBy: member.accountId,
        state: "completed",
        delivery: 1,
      });
      expect(replayed.keys.some((row) => row.accountId === accountId && row.workbenchId === "assigned")).toBe(false);
    } finally {
      await complete.close();
    }
    expect((await request(owner.token, `${team}/members/${member.accountId}/remove`, {})).status).toBe(200);
    expect((await request(member.token, receipt)).status).toBe(401);
    expect((await request(member.token, "/v1/account")).status).toBe(200);
  } finally {
    await Promise.all([
      authentication.close(),
      auth.close(),
      manager.close(),
      recovered.close(),
      completedRecovery.close(),
    ]);
  }
});
