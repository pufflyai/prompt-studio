import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";
import { teamInvitations } from "./schema";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("owner-issued desktop codes admit one signed-in person without granting projects", async () => {
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const { auth, config } = authentication;
  const handler = implementation.createManagerHandler(auth, config.origin);
  const device = async () => {
    const login = await authentication.login(crypto.randomUUID());
    return { ...login, ...(await auth.loginDevice(login.headers, deviceProfile())) };
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
    const morgan = await device();
    const casey = await device();
    const { accountId } = await (await request(owner.token, "/v1/teams", { name: "Studio Team" })).json();
    const team = `/v1/teams/${accountId}`;
    const invite = async () => {
      const response = await request(owner.token, `${team}/invite-codes`, {});
      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(new Date(result.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
      return result;
    };
    const issued = await invite();
    expect(await (await request(owner.token, `${team}/invite-codes`)).json()).toEqual([
      { id: issued.id, expiresAt: issued.expiresAt },
    ]);
    expect(await (await request(owner.token, `${team}/invitations`)).json()).toEqual([]);
    expect((await request(casey.token, `${team}/invite-codes`, {})).status).toBe(403);
    expect((await request(casey.token, `${team}/invite-codes`)).status).toBe(403);
    expect(
      await (await request(morgan.token, "/v1/team-invitations/inspect", { secret: issued.code })).json(),
    ).toMatchObject({ state: "pending", teamName: "Studio Team" });
    const contenders = await Promise.all(
      [morgan, casey].map(async (person) => ({
        person,
        response: await request(person.token, "/v1/team-invitations/accept", { secret: issued.code }),
      })),
    );
    expect(contenders.map(({ response }) => response.status).sort()).toEqual([200, 403]);
    const winner = contenders.find(({ response }) => response.status === 200)!.person;
    expect((await request(winner.token, "/v1/team-invitations/accept", { secret: issued.code })).status).toBe(200);
    expect(await (await request(winner.token, `/v1/workbenches?accountId=${accountId}`)).json()).toEqual([]);
    expect((await request(winner.token, `${team}/invite-codes`, {})).status).toBe(403);
    expect(await (await request(owner.token, `${team}/members`)).json()).toHaveLength(2);
    const row = await authentication.connection.db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, issued.id));
    expect(JSON.stringify(row)).not.toContain(issued.code);
    expect(row[0].digest).toHaveLength(64);
    const stale = await invite();
    expect((await request(owner.token, `${team}/members/${winner.accountId}/remove`, {})).status).toBe(200);
    expect((await request(winner.token, "/v1/team-invitations/accept", { secret: issued.code })).status).toBe(403);
    expect((await request(winner.token, "/v1/team-invitations/accept", { secret: stale.code })).status).toBe(403);
    const renewed = await invite();
    expect((await request(winner.token, "/v1/team-invitations/accept", { secret: renewed.code })).status).toBe(200);
    const canceled = await invite();
    await request(owner.token, `${team}/invitations/${canceled.id}/cancel`, {});
    expect((await request(casey.token, "/v1/team-invitations/accept", { secret: canceled.code })).status).toBe(403);
    const expired = await invite();
    await authentication.connection.db
      .update(teamInvitations)
      .set({ expiresAt: new Date(0) })
      .where(eq(teamInvitations.id, expired.id));
    expect(
      await (await request(casey.token, "/v1/team-invitations/inspect", { secret: expired.code })).json(),
    ).toMatchObject({ state: "expired" });
    expect((await request(casey.token, "/v1/team-invitations/accept", { secret: expired.code })).status).toBe(403);
    expect((await request(owner.token, `${team}/members/${owner.accountId}/remove`, {})).status).toBe(403);
  } finally {
    await authentication.close();
  }
});
