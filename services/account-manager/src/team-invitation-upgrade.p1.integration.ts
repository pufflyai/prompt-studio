import { expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import { createCredential, digestCredential } from "./credential";
import { connectManager } from "./database";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";
import { createOAuthCodeFixture, fixtureMicrosoftClient, oauthBrowserCookie } from "./oauth-code.fixture";

const migrations = resolve(import.meta.dir, "../drizzle");

const stageGoogleInvitationSchema = async (directory: string) => {
  const journal = await Bun.file(join(migrations, "meta/_journal.json")).json();
  const change = journal.entries.findIndex(({ tag }: { tag: string }) => tag === "0011_microsoft_team_invitation");
  expect(change).toBeGreaterThan(0);
  const entries: { tag: string }[] = journal.entries.slice(0, change);
  await mkdir(join(directory, "meta"));
  await Promise.all([
    writeFile(join(directory, "meta/_journal.json"), JSON.stringify({ ...journal, entries })),
    ...entries.map(({ tag }) => copyFile(join(migrations, `${tag}.sql`), join(directory, `${tag}.sql`))),
  ]);
};

test("the Microsoft invitation migration preserves a Google invitation, an enrolled team and its project keys", async () => {
  const previousMigrations = await mkdtemp(join(tmpdir(), "manager-before-microsoft-invitations-"));
  const fixture = createAuthorityFixture(implementation);
  const config = authenticationConfig(fixture.databaseUrl);
  const oauth = await createOAuthCodeFixture();
  const manager = fixture.owner();
  const db = connectManager(fixture.databaseUrl);
  let auth = implementation.createManagerAuthentication(config);
  let handler = implementation.createManagerHandler(auth, config.origin);
  const get = (path: string, headers?: HeadersInit) => handler(new Request(config.origin + path, { headers }));
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
  const googleSession = async (sub: string, email: string) => {
    const login = await post("/api/auth/sign-in/social", {
      provider: "google",
      callbackURL: `${config.origin}/v1/team-invitation`,
    });
    expect(login.status).toBe(200);
    const { url } = (await login.json()) as { url: string };
    const callback = await oauth.complete("google", new URL(url), { claims: { sub, email } });
    const response = await get(callback.pathname + callback.search, { cookie: oauthBrowserCookie(login) });
    expect(response.headers.get("location")).toBe(`${config.origin}/v1/team-invitation`);
    return { cookie: oauthBrowserCookie(response) };
  };

  try {
    await stageGoogleInvitationSchema(previousMigrations);
    await fixture.initialize(previousMigrations);
    const ownerSession = await googleSession("legacy-owner", "owner@fixture.test");
    const owner = await auth.loginDevice(new Headers(ownerSession), deviceProfile());
    const ownerCredentials = { authorization: `Bearer ${owner.token}` };
    const invitedEmail = "invited@fixture.test";
    const invited = await googleSession("legacy-recipient", invitedEmail);

    const team = await post("/v1/teams", { name: "Existing team" }, ownerCredentials);
    expect(team.status).toBe(201);
    const { accountId } = (await team.json()) as { accountId: string };
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
    expect((await post(`/v1/workbenches/existing-project?accountId=${accountId}`, {}, ownerCredentials)).status).toBe(
      200,
    );

    const workbenches = `/v1/workbenches?accountId=${accountId}`;
    const [grant] = (await (await get(workbenches, ownerCredentials)).json()) as { grantId: string }[];
    expect(grant?.grantId).toBeTruthy();
    const keysPath = `/v1/workbenches/existing-project/keys?accountId=${accountId}&grantId=${grant!.grantId}`;
    const keys = await get(keysPath, ownerCredentials);
    expect(keys.status).toBe(200);
    const previousKeys: unknown = await keys.json();
    const previousSigningKeys = await auth.jwks();
    expect(previousSigningKeys.keys.length).toBeGreaterThan(0);

    // Seed the original schema directly because the current invitation writer includes Microsoft columns.
    const secret = createCredential();
    const invitationId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 86_400_000);
    await db.db.execute(sql`
      insert into manager_team_invitations (id, "accountId", email, digest, "expiresAt", state)
      values (${invitationId}, ${accountId}, ${invitedEmail}, ${digestCredential(secret)}, ${expiresAt.toISOString()}, 'pending')
    `);

    await auth.close();
    await implementation.migrateAccountManager(fixture.databaseUrl, migrations);
    await implementation.migrateAccountManager(fixture.databaseUrl, migrations);
    auth = implementation.createManagerAuthentication({ ...config, microsoft: fixtureMicrosoftClient });
    handler = implementation.createManagerHandler(auth, config.origin);

    expect(await auth.jwks()).toEqual(previousSigningKeys);
    expect(await (await get(workbenches, ownerCredentials)).json()).toEqual([grant]);
    expect(await (await get(keysPath, ownerCredentials)).json()).toEqual(previousKeys);
    expect(await (await get(`/v1/teams/${accountId}/invitations`, ownerCredentials)).json()).toEqual([
      { id: invitationId, email: invitedEmail, expiresAt: expiresAt.toISOString() },
    ]);
    const inspected = await post("/v1/team-invitation/inspect", { secret }, invited);
    expect(await inspected.json()).toMatchObject({ state: "pending", signedInEmail: invitedEmail });
    const accepted = await post("/v1/team-invitation/accept", { secret }, invited);
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ state: "joined", accountId });
    const recipient = await auth.loginDevice(new Headers(invited), deviceProfile());
    expect(await (await get(workbenches, { authorization: `Bearer ${recipient.token}` })).json()).toEqual([]);
  } finally {
    oauth.close();
    await Promise.all([auth.close(), db.close(), manager.close(), fixture.close()]);
    await rm(previousMigrations, { recursive: true, force: true });
  }
});
