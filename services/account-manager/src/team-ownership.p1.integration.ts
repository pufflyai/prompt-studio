import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("team owners transfer by verified member identity without moving project grants", async () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const { auth, config } = authentication;
  const handler = implementation.createManagerHandler(auth, config.origin);
  const person = async () => {
    const email = `${crypto.randomUUID()}@fixture.test`;
    const login = await authentication.login(crypto.randomUUID(), email);
    return { ...(await auth.loginDevice(login.headers, deviceProfile())), email, subject: login.subject };
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
    const alex = await person();
    const morgan = await person();
    const casey = await person();
    const { accountId } = await (await request(alex.token, "/v1/teams", { name: "Studio" })).json();
    const team = `/v1/teams/${accountId}`;
    const projectPath = `/v1/workbenches/project?accountId=${accountId}`;
    const join = async (person: typeof morgan) => {
      const { url } = await (await request(alex.token, `${team}/invitations`, { email: person.email })).json();
      const joined = await request(person.token, "/v1/team-invitations/accept", { secret: new URL(url).hash.slice(1) });
      expect(joined.status).toBe(200);
    };
    const roster = async (token: string) => (await request(token, `${team}/members`)).json();
    const offer = (token: string, recipientUserId: string) => request(token, `${team}/ownership`, { recipientUserId });
    const answer = (token: string, id: string, decision: "accept" | "decline" | "cancel") =>
      request(token, `${team}/ownership/${id}`, { decision });
    const currentOffer = async (token: string) => (await request(token, `${team}/ownership`)).json();
    const grantId = async (token: string) => {
      const roster = await (await request(token, `/v1/workbenches?accountId=${accountId}`)).json();
      return Array.isArray(roster) ? roster[0]?.grantId : undefined;
    };
    const renew = async (token: string) =>
      request(token, "/v1/environment-access", { accountId, workbenchId: "project", grantId: await grantId(token) });
    const keys = async (token: string) =>
      request(token, `/v1/workbenches/project/keys?accountId=${accountId}&grantId=${(await grantId(token)) ?? ""}`);
    const start = async () => {
      const result = await offer(alex.token, morgan.accountId);
      expect(result.status).toBe(201);
      return result.json();
    };

    expect((await offer(alex.token, morgan.accountId)).status).toBe(403);
    await join(morgan);
    await join(casey);
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
    expect((await request(alex.token, projectPath, {})).status).toBe(200);
    expect((await request(alex.token, `${team}/leave`, {})).status).toBe(403);
    expect((await offer(morgan.token, casey.accountId)).status).toBe(403);

    const first = await start();
    expect((await offer(alex.token, casey.accountId)).status).toBe(403);
    expect(await currentOffer(morgan.token)).toMatchObject({ id: first.id, ownerUserId: alex.accountId });
    expect(await currentOffer(casey.token)).toBeNull();
    expect((await answer(casey.token, first.id, "accept")).status).toBe(403);
    expect((await answer(alex.token, first.id, "cancel")).status).toBe(200);
    expect((await answer(morgan.token, first.id, "accept")).status).toBe(403);

    const declined = await start();
    expect((await answer(morgan.token, declined.id, "decline")).status).toBe(200);
    const removed = await start();
    expect((await request(alex.token, `${team}/members/${morgan.accountId}/remove`, {})).status).toBe(200);
    await join(morgan);
    expect((await answer(morgan.token, removed.id, "accept")).status).toBe(403);
    const historical = await manager.snapshot();

    const final = await start();
    const repeated = await Promise.all([
      answer(morgan.token, final.id, "accept"),
      answer(morgan.token, final.id, "accept"),
    ]);
    expect(repeated.map(({ status }) => status)).toEqual([200, 200]);
    expect(await roster(morgan.token)).toEqual([
      expect.objectContaining({ userId: morgan.accountId, role: "owner" }),
      ...[alex.accountId, casey.accountId].sort().map((id) => expect.objectContaining({ userId: id, role: "member" })),
    ]);
    expect((await offer(alex.token, casey.accountId)).status).toBe(403);
    expect((await request(alex.token, `${team}/invitations`, { email: "new@example.test" })).status).toBe(403);
    expect((await request(morgan.token, `${team}/invitations`, { email: "new@example.test" })).status).toBe(201);
    expect((await renew(alex.token)).status).toBe(200);
    expect((await renew(morgan.token)).status).toBe(401);
    expect((await keys(morgan.token)).status).toBe(404);

    const shared = (await (await keys(alex.token)).json()).project;
    expect(
      (await request(morgan.token, `${team}/projects/project/access`, { userId: morgan.accountId, granted: true }))
        .status,
    ).toBe(200);
    expect((await request(alex.token, `${team}/leave`, {})).status).toBe(200);
    expect((await renew(alex.token)).status).toBe(401);
    expect((await renew(morgan.token)).status).toBe(200);
    expect((await (await keys(morgan.token)).json()).project).toEqual([
      ...shared,
      { generation: 2, secret: expect.any(String) },
    ]);

    const pending = (await (await offer(morgan.token, casey.accountId)).json()).id;
    await manager.restore("restore-before-transfer", historical);
    const reopen = async (id: string, subject?: string) =>
      manager.reconcile({
        requestId: `restore-${id}`,
        accountId: id,
        state: "active",
        ...(subject && { owner: { issuer: "https://accounts.google.com", subject } }),
      });
    await reopen(accountId);
    await reopen(morgan.accountId, morgan.subject);
    await reopen(casey.accountId, casey.subject);
    const returned = await manager.registerDevice({ accountId: morgan.accountId, ...deviceProfile() });
    const recipient = await manager.registerDevice({ accountId: casey.accountId, ...deviceProfile() });
    expect(await currentOffer(returned.token)).toBeNull();
    expect((await answer(recipient.token, pending, "accept")).status).toBe(403);
    const afterRestore = await roster(returned.token);
    expect(afterRestore[0]).toMatchObject({ userId: morgan.accountId, role: "owner" });
    expect(afterRestore.some((member: { userId: string }) => member.userId === alex.accountId)).toBe(false);
    expect((await renew(returned.token)).status).toBe(200);
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});
