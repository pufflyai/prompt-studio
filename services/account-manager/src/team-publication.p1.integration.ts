import { afterAll, beforeAll, expect, test } from "bun:test";
import { createHmac, hkdfSync } from "node:crypto";
import { spaceKeysSchema, teamOwnershipOfferSchema } from "pstdio-sync-contracts";
import { createAuthorityFixture, deviceProfile, provisionAccount } from "./authority.fixture";
import { connectManager } from "./database";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";
import { teamMembers } from "./schema";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("the team owner and a project member get different publication permissions on the same encrypted catalog", async () => {
  const manager = fixture.owner();
  const connection = connectManager(fixture.databaseUrl);
  const config = authenticationConfig(fixture.databaseUrl);
  const auth = implementation.createManagerAuthentication(config);
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
    const ownerId = await provisionAccount(manager);
    const colleagueId = await provisionAccount(manager);
    const owner = await manager.registerDevice({ accountId: ownerId, ...deviceProfile() });
    const colleague = await manager.registerDevice({ accountId: colleagueId, ...deviceProfile() });
    const team = await request(owner.token, "/v1/teams", { name: "Private Tools" });
    expect(team.status).toBe(201);
    const { accountId } = (await team.json()) as { accountId: string };
    const workbenchId = "team-publication";
    const scope = { accountId, workbenchId };
    const projectPath = `/v1/workbenches/${workbenchId}`;
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
    expect((await request(owner.token, `${projectPath}?accountId=${accountId}`, {})).status).toBe(200);
    // Set up a colleague's explicit grant without using a pending invitation delivery.
    await connection.db.insert(teamMembers).values({ accountId, userId: colleagueId, role: "member" });
    const projectAccess = `/v1/teams/${accountId}/projects/${workbenchId}/access`;
    expect((await request(owner.token, projectAccess, { userId: colleagueId, granted: true })).status).toBe(200);
    const grantId = async (token: string) => {
      const roster = await (await request(token, `/v1/workbenches?accountId=${accountId}`)).json();
      return Array.isArray(roster) ? roster[0]?.grantId : undefined;
    };

    const verify = implementation.createEnvironmentAccessVerifier({
      issuer: config.origin,
      audience: config.audience,
      jwks: await auth.jwks(),
    });
    const renewal = async (token: string) =>
      request(token, "/v1/environment-access", { ...scope, grantId: await grantId(token) });
    const access = async (token: string) => {
      const result = await renewal(token);
      expect(result.status).toBe(200);
      const value = (await result.json()) as { token: string; canPublish?: boolean };
      return { grants: await verify(value.token), canPublish: value.canPublish };
    };

    // The owner can renew before any device requests project keys.
    const first = await access(owner.token);
    const keyPath = `${projectPath}/keys?accountId=${accountId}&grantId=${await grantId(colleague.token)}`;
    const keys = spaceKeysSchema.parse(await (await request(colleague.token, keyPath)).json());
    const naming = hkdfSync(
      "sha256",
      Buffer.from(keys.project[0]!.secret, "base64url"),
      "",
      "pstdio-sync document id v1",
      64,
    );
    const documents = ["owner", "record-stream-v2"].map((part) =>
      createHmac("sha256", Buffer.from(naming))
        .update(JSON.stringify(["pstdio.published-extensions", part]))
        .digest()
        .subarray(0, 16)
        .toString("base64url"),
    );
    expect(first).toMatchObject({ grants: { publication: { documents, canWrite: true } }, canPublish: true });
    expect(await access(colleague.token)).toMatchObject({
      grants: { publication: { documents, canWrite: false } },
      canPublish: false,
    });

    const ownership = `/v1/teams/${accountId}/ownership`;
    const offer = await request(owner.token, ownership, { recipientUserId: colleagueId });
    expect(offer.status).toBe(201);
    const { id } = teamOwnershipOfferSchema.parse(await offer.json());
    expect((await request(colleague.token, `${ownership}/${id}`, { decision: "accept" })).status).toBe(200);
    expect((await access(owner.token)).canPublish).toBe(false);
    expect((await access(colleague.token)).canPublish).toBe(true);
    expect((await request(colleague.token, projectAccess, { userId: ownerId, granted: false })).status).toBe(200);
    expect((await renewal(owner.token)).status).toBe(401);
  } finally {
    await Promise.all([auth.close(), manager.close(), connection.close()]);
  }
});
