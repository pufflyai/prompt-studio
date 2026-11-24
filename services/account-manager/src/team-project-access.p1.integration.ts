import { afterAll, beforeAll, expect, test } from "bun:test";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("team project access is explicit and revocation rotates only the affected shared keys", async () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const { auth, config } = authentication;
  const handler = implementation.createManagerHandler(auth, config.origin);
  const device = async (email?: string) => {
    const login = await authentication.login(crypto.randomUUID(), email);
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
    const alex = await device();
    const morganEmail = `${crypto.randomUUID()}@fixture.test`;
    const morgan = await device(morganEmail);
    const caseyEmail = `${crypto.randomUUID()}@fixture.test`;
    const casey = await device(caseyEmail);
    const { accountId } = await (await request(alex.token, "/v1/teams", { name: "Studio" })).json();
    const team = `/v1/teams/${accountId}`;
    const query = `?accountId=${accountId}`;
    const join = async (email: string, token: string) => {
      const { url } = await (await request(alex.token, `${team}/invitations`, { email })).json();
      const joined = await request(token, "/v1/team-invitations/accept", { secret: new URL(url).hash.slice(1) });
      expect(joined.status).toBe(200);
    };
    await join(morganEmail, morgan.token);
    await join(caseyEmail, casey.token);
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
    const add = (id: string) => request(alex.token, `/v1/workbenches/${id}${query}`, {});
    const catalog = async (token: string) => (await request(token, `/v1/workbenches${query}`)).json();
    const keys = (token: string, id: string) => request(token, `/v1/workbenches/${id}/keys${query}`);
    const renew = (token: string, workbenchId: string) =>
      request(token, "/v1/environment-access", { accountId, workbenchId });
    const grant = (project: string, userId: string, granted: boolean, token = alex.token) =>
      request(token, `${team}/projects/${project}/access`, { userId, granted });

    expect((await add("project-a")).status).toBe(200);
    expect((await add("project-b")).status).toBe(200);
    expect(await catalog(morgan.token)).toEqual([]);
    expect((await grant("project-a", morgan.accountId, true, morgan.token)).status).toBe(403);
    expect((await grant("project-a", "outsider", true)).status).toBe(403);
    expect((await grant("project-a", morgan.accountId, true)).status).toBe(200);
    expect((await request(morgan.token, `${team}/projects`)).status).toBe(403);
    expect(await (await request(alex.token, `${team}/projects`)).json()).toEqual([
      { workbenchId: "project-a", userIds: [alex.accountId, morgan.accountId].sort() },
      { workbenchId: "project-b", userIds: [alex.accountId] },
    ]);
    expect(await catalog(morgan.token)).toEqual([{ workbenchId: "project-a" }]);
    expect(await catalog(casey.token)).toEqual([]);
    expect((await keys(morgan.token, "project-b")).status).toBe(404);
    expect((await renew(casey.token, "project-a")).status).toBe(401);
    expect((await renew(morgan.token, "project-a")).status).toBe(200);
    const alexBefore = await (await keys(alex.token, "project-a")).json();
    const morganBefore = await (await keys(morgan.token, "project-a")).json();
    const projectBBefore = await (await keys(alex.token, "project-b")).json();
    expect(morganBefore.project).toEqual(alexBefore.project);
    expect(morganBefore.personal).not.toEqual(alexBefore.personal);

    expect((await grant("project-a", morgan.accountId, false)).status).toBe(200);
    expect(await catalog(morgan.token)).toEqual([]);
    expect((await keys(morgan.token, "project-a")).status).toBe(404);
    expect((await renew(morgan.token, "project-a")).status).toBe(401);
    const rotated = await (await keys(alex.token, "project-a")).json();
    expect(rotated.project).toEqual([...alexBefore.project, { generation: 2, secret: expect.any(String) }]);
    expect(rotated.personal).toEqual(alexBefore.personal);
    expect(await (await keys(alex.token, "project-b")).json()).toEqual(projectBBefore);
    expect((await grant("project-a", morgan.accountId, false)).status).toBe(200);
    expect(await (await keys(alex.token, "project-a")).json()).toEqual(rotated);

    expect((await grant("project-a", alex.accountId, false)).status).toBe(200);
    expect(await catalog(alex.token)).toEqual([{ workbenchId: "project-b" }]);
    expect((await add("project-a")).status).toBe(403);
    expect((await keys(alex.token, "project-a")).status).toBe(404);
    expect((await request(alex.token, `${team}/projects`)).status).toBe(200);
    expect((await grant("project-a", alex.accountId, true)).status).toBe(200);
    expect((await grant("project-b", morgan.accountId, true)).status).toBe(200);
    await keys(morgan.token, "project-b");
    expect((await request(morgan.token, `${team}/leave`, {})).status).toBe(200);
    expect((await renew(morgan.token, "project-b")).status).toBe(401);
    expect((await (await keys(alex.token, "project-b")).json()).project).toHaveLength(2);
    expect((await (await keys(alex.token, "project-a")).json()).project).toHaveLength(3);
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});
