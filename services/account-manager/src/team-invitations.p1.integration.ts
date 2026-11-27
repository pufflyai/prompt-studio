import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";
import { teamInvitations } from "./schema";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("verified recipients can join and leave without inheriting project or device authority", async () => {
  const manager = fixture.owner();
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const { auth, config } = authentication;
  const handler = implementation.createManagerHandler(auth, config.origin);
  const device = async (email?: string) => {
    const login = await authentication.login(crypto.randomUUID(), email);
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
  const browserRequest = (headers: Headers, action: string, invitation: { secret: string }) =>
    handler(
      new Request(`${config.origin}/v1/team-invitation/${action}`, {
        method: "POST",
        headers: { ...Object.fromEntries(headers), origin: config.origin, "content-type": "application/json" },
        body: JSON.stringify(invitation),
      }),
    );
  try {
    const owner = await device();
    const email = `${crypto.randomUUID()}@fixture.test`;
    const recipient = await device(email);
    const outsider = await device();
    const { accountId } = await (await request(owner.token, "/v1/teams", { name: "Studio Team" })).json();
    const team = `/v1/teams/${accountId}`;
    const scoped = `?accountId=${accountId}`;
    const invite = async () => {
      const created = await request(owner.token, `${team}/invitations`, { email });
      expect(created.status).toBe(201);
      return created.json();
    };
    const initial = await invite();
    const presented = { secret: new URL(initial.url).hash.slice(1) };
    expect(presented.secret).toMatch(/^[a-zA-Z0-9_-]{43}$/);
    const pending = await (await request(owner.token, `${team}/invitations`)).json();
    expect(pending).toEqual([{ id: initial.id, email, expiresAt: initial.expiresAt }]);
    expect(await (await request(outsider.token, "/v1/team-invitations/inspect", presented)).json()).toMatchObject({
      state: "wrong-identity",
    });
    expect((await request(outsider.token, "/v1/team-invitations/accept", presented)).status).toBe(403);
    expect(await (await request(recipient.token, "/v1/team-invitations/inspect", presented)).json()).toMatchObject({
      state: "pending",
      teamName: "Studio Team",
      signedInEmail: email,
    });
    expect(await (await request(recipient.token, "/v1/teams")).json()).toEqual([]);
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
    expect((await request(owner.token, `/v1/workbenches/studio-project${scoped}`, {})).status).toBe(200);
    const accepted = await Promise.all([
      request(recipient.token, "/v1/team-invitations/accept", presented),
      request(recipient.token, "/v1/team-invitations/accept", presented),
    ]);
    for (const result of accepted) {
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({ accountId, state: "joined" });
    }
    expect(await (await request(recipient.token, `${team}/members`)).json()).toEqual([
      expect.objectContaining({ userId: owner.accountId, role: "owner" }),
      expect.objectContaining({ userId: recipient.accountId, role: "member" }),
    ]);
    const priorMembership = await manager.snapshot();
    expect(JSON.stringify(priorMembership)).not.toContain(presented.secret);
    expect(await (await request(recipient.token, `/v1/workbenches${scoped}`)).json()).toEqual([]);
    expect((await request(recipient.token, `/v1/workbenches/studio-project/keys${scoped}`)).status).toBe(404);
    expect(
      (await request(recipient.token, "/v1/environment-access", { accountId, workbenchId: "studio-project" })).status,
    ).toBe(401);
    expect((await request(recipient.token, `${team}/invitations`, { email: "new@fixture.test" })).status).toBe(403);
    expect((await request(recipient.token, `${team}/members/${owner.accountId}/remove`, {})).status).toBe(403);
    expect((await request(owner.token, `${team}/leave`, {})).status).toBe(403);
    expect((await request(owner.token, `${team}/members/${recipient.accountId}/remove`, {})).status).toBe(200);
    expect((await request(recipient.token, "/v1/team-invitations/accept", presented)).status).toBe(403);
    expect(await (await request(recipient.token, "/v1/teams")).json()).toEqual([]);
    const canceled = await invite();
    expect((await request(owner.token, `${team}/invitations/${canceled.id}/cancel`, {})).status).toBe(200);
    expect(
      (await request(recipient.token, "/v1/team-invitations/accept", { secret: new URL(canceled.url).hash.slice(1) }))
        .status,
    ).toBe(403);
    const linkInput = ({ url }: { url: string }) => ({ secret: new URL(url).hash.slice(1) });
    const expired = await invite();
    await authentication.connection.db
      .update(teamInvitations)
      .set({ expiresAt: new Date(0) })
      .where(eq(teamInvitations.id, expired.id));
    expect(
      await (await request(recipient.token, "/v1/team-invitations/inspect", linkInput(expired))).json(),
    ).toMatchObject({ state: "expired" });
    expect((await request(recipient.token, "/v1/team-invitations/accept", linkInput(expired))).status).toBe(403);

    const replacement = await invite();
    const page = await handler(new Request(replacement.url));
    expect(page.status).toBe(200);
    expect(await page.text()).not.toContain(linkInput(replacement).secret);
    expect((await browserRequest(outsider.headers, "accept", linkInput(replacement))).status).toBe(403);
    expect(await (await browserRequest(recipient.headers, "inspect", linkInput(replacement))).json()).toMatchObject({
      state: "pending",
      teamName: "Studio Team",
    });
    expect((await browserRequest(recipient.headers, "accept", linkInput(replacement))).status).toBe(200);
    expect((await request(recipient.token, `${team}/leave`, {})).status).toBe(200);
    expect(await (await request(recipient.token, "/v1/teams")).json()).toEqual([]);
    expect((await request(recipient.token, "/v1/devices")).status).toBe(200);

    const pendingAtRestore = await invite();
    await manager.restore("invitation-restore", priorMembership);
    await manager.reconcile({ requestId: "restore-team", accountId, state: "active" });
    await manager.reconcile({
      requestId: "restore-recipient",
      accountId: recipient.accountId,
      state: "active",
      owner: { issuer: "https://accounts.google.com", subject: recipient.subject },
    });
    const returned = await manager.registerDevice({ accountId: recipient.accountId, ...deviceProfile() });
    expect(await (await request(returned.token, "/v1/teams")).json()).toEqual([]);
    expect(
      await (await request(returned.token, "/v1/team-invitations/inspect", linkInput(pendingAtRestore))).json(),
    ).toMatchObject({ state: "canceled" });
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});
