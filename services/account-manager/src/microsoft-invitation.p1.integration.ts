import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import { connectManager } from "./database";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";
import { createOAuthCodeFixture, fixtureMicrosoftClient, oauthBrowserCookie } from "./oauth-code.fixture";
import { teamInvitations } from "./schema";

const workTenant = "3421902b-7d60-41c9-a395-7412a9189c30";
const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("a Microsoft work invitation is bound to a verified directory object before the employee enrolls a device", async () => {
  const config = { ...authenticationConfig(fixture.databaseUrl), microsoft: fixtureMicrosoftClient };
  const manager = fixture.owner();
  const auth = implementation.createManagerAuthentication(config);
  const connection = connectManager(fixture.databaseUrl);
  const oauth = await createOAuthCodeFixture();
  const handle = implementation.createManagerHandler(auth, config.origin);
  const post = (path: string, body: unknown, headers?: HeadersInit) =>
    handle(
      new Request(config.origin + path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: config.origin,
          ...Object.fromEntries(new Headers(headers)),
        },
        body: JSON.stringify(body),
      }),
    );

  const signIn = async (provider: "google" | "microsoft", claims?: Record<string, unknown>) => {
    const begin = await post("/api/auth/sign-in/social", {
      provider,
      callbackURL: `${config.origin}/v1/team-invitation`,
    });
    expect(begin.status).toBe(200);
    const { url } = (await begin.json()) as { url: string };
    const callback = await oauth.complete(provider, new URL(url), {
      claims: provider === "microsoft" ? { tid: workTenant, ...claims } : claims,
    });
    const completed = await handle(new Request(callback, { headers: { cookie: oauthBrowserCookie(begin) } }));
    expect(completed.headers.get("location")).toBe(`${config.origin}/v1/team-invitation`);
    return { cookie: oauthBrowserCookie(completed) };
  };

  try {
    const ownerSession = await signIn("microsoft", { sub: "team-owner", oid: crypto.randomUUID() });
    const owner = await auth.loginDevice(new Headers(ownerSession), { ...deviceProfile(), provider: "microsoft" });
    const credentials = { authorization: `Bearer ${owner.token}` };
    const team = await post("/v1/teams", { name: "Private tools" }, credentials);
    expect(team.status).toBe(201);
    const { accountId } = (await team.json()) as { accountId: string };
    const objectId = crypto.randomUUID();
    const recipient = { microsoft: { tenantId: workTenant, objectId } };
    const invitationPath = `/v1/teams/${accountId}/invitations`;
    expect((await post(invitationPath, { ...recipient, email: "owner@fixture.test" }, credentials)).status).toBe(400);
    expect((await post(invitationPath, {}, credentials)).status).toBe(400);
    const create = async () => {
      const result = await post(invitationPath, recipient, credentials);
      expect(result.status).toBe(201);
      const invitation = (await result.json()) as { id: string; url: string };
      return { id: invitation.id, secret: new URL(invitation.url).hash.slice(1) };
    };
    const old = await create();
    const choice = await create();
    const outstanding = await handle(new Request(config.origin + invitationPath, { headers: credentials }));
    expect(await outstanding.json()).toEqual([{ ...recipient, id: choice.id, expiresAt: expect.any(String) }]);
    const browser = (action: string, invite: { secret: string }, headers?: HeadersInit) =>
      post(`/v1/team-invitation/${action}`, { secret: invite.secret }, headers);
    const challenge = await browser("inspect", choice);
    expect(challenge.status).toBe(401);
    expect(await challenge.json()).toMatchObject({ provider: "microsoft" });

    const other = await signIn("microsoft", { sub: "wrong-work-account", oid: crypto.randomUUID() });
    const anotherTenant = await signIn("microsoft", { tid: "b8cf818a-09e1-4b19-95b4-2f416fb0c607", oid: objectId });
    const withoutProof = await signIn("microsoft", { sub: "no-directory-object" });
    const google = await signIn("google");
    for (const session of [other, anotherTenant, withoutProof, google]) {
      expect(await (await browser("inspect", choice, session)).json()).toMatchObject({ state: "wrong-identity" });
      expect((await browser("accept", choice, session)).status).toBe(403);
    }

    const intended = await signIn("microsoft", { oid: objectId, email: undefined });
    expect(await (await browser("inspect", choice, intended)).json()).toMatchObject({
      state: "pending",
      provider: "microsoft",
      teamName: "Private tools",
    });
    expect(await (await browser("inspect", old, intended)).json()).toMatchObject({ state: "canceled" });
    const joined = await browser("accept", choice, intended);
    expect(joined.status).toBe(200);
    expect(await (await browser("accept", choice, intended)).json()).toEqual({ accountId, state: "joined" });

    expect((await post(invitationPath, recipient, credentials)).status).toBe(403);
    const employee = await auth.loginDevice(new Headers(intended), { ...deviceProfile(), provider: "microsoft" });
    await expect(manager.snapshot()).resolves.toMatchObject({
      teamMembers: expect.arrayContaining([
        expect.objectContaining({ accountId, userId: employee.accountId, role: "member" }),
      ]),
    });
    expect((await post(`/v1/teams/${accountId}/members/${employee.accountId}/remove`, {}, credentials)).status).toBe(
      200,
    );
    expect((await browser("accept", choice, intended)).status).toBe(403);

    const canceled = await create();
    expect((await post(`/v1/teams/${accountId}/invitations/${canceled.id}/cancel`, {}, credentials)).status).toBe(200);
    expect((await browser("accept", canceled, intended)).status).toBe(403);
    const expired = await create();
    await connection.db
      .update(teamInvitations)
      .set({ expiresAt: new Date(0) })
      .where(eq(teamInvitations.id, expired.id));
    expect(await (await browser("inspect", expired, intended)).json()).toMatchObject({ state: "expired" });
    expect((await browser("accept", expired, intended)).status).toBe(403);
  } finally {
    oauth.close();
    await Promise.all([auth.close(), manager.close(), connection.close()]);
  }
});
