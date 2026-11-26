import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import * as implementation from "./index";
import { authenticationConfig, createAuthenticationFixture } from "./manager-authentication.fixture";
import { createOAuthCodeFixture, fixtureMicrosoftClient, oauthBrowserCookie } from "./oauth-code.fixture";
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
    expect((await request(casey.token, `${team}/invite-codes`, {})).status).toBe(401);
    expect((await request(casey.token, `${team}/invite-codes`)).status).toBe(401);
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
    expect((await request(casey.token, "/v1/team-invitations/accept", { secret: stale.code })).status).toBe(403);
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

test("Microsoft principals can use a desktop code without an email claim", async () => {
  const config = { ...authenticationConfig(fixture.databaseUrl), microsoft: fixtureMicrosoftClient };
  const auth = implementation.createManagerAuthentication(config);
  const oauth = await createOAuthCodeFixture();
  const handler = implementation.createManagerHandler(auth, config.origin);
  const post = (path: string, body: unknown, headers?: HeadersInit) =>
    handler(
      new Request(config.origin + path, {
        method: "POST",
        headers: {
          ...Object.fromEntries(new Headers(headers)),
          origin: config.origin,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  const tenant = crypto.randomUUID();
  const signIn = async () => {
    const begin = await post("/api/auth/sign-in/social", {
      provider: "microsoft",
      callbackURL: `${config.origin}/v1/team-invitation`,
    });
    expect(begin.status).toBe(200);
    const { url } = await begin.json();
    const callback = await oauth.complete("microsoft", new URL(url), {
      claims: { tid: tenant, sub: crypto.randomUUID(), oid: crypto.randomUUID(), email: undefined },
    });
    const completed = await handler(new Request(callback, { headers: { cookie: oauthBrowserCookie(begin) } }));
    expect(completed.headers.get("location")).toBe(`${config.origin}/v1/team-invitation`);
    return auth.loginDevice(new Headers({ cookie: oauthBrowserCookie(completed) }), {
      ...deviceProfile(),
      provider: "microsoft",
    });
  };
  try {
    const owner = await signIn();
    const recipient = await signIn();
    expect(recipient.accountId).not.toBe(owner.accountId);
    const credentials = { authorization: `Bearer ${owner.token}` };
    const created = await post("/v1/teams", { name: "No-email Microsoft team" }, credentials);
    expect(created.status).toBe(201);
    const { accountId } = await created.json();
    const issued = await post(`/v1/teams/${accountId}/invite-codes`, {}, credentials);
    expect(issued.status).toBe(201);
    const { code } = await issued.json();
    const signedIn = { authorization: `Bearer ${recipient.token}` };
    expect(await (await post("/v1/team-invitations/inspect", { secret: code }, signedIn)).json()).toMatchObject({
      state: "pending",
      teamName: "No-email Microsoft team",
    });
    expect(await (await post("/v1/team-invitations/accept", { secret: code }, signedIn)).json()).toEqual({
      state: "joined",
      accountId,
    });
    expect(
      (await handler(new Request(`${config.origin}/v1/workbenches?accountId=${accountId}`, { headers: signedIn })))
        .status,
    ).toBe(200);
  } finally {
    oauth.close();
    await auth.close();
  }
});
