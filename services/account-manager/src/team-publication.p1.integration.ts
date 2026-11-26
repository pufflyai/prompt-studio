import { afterAll, beforeAll, expect, test } from "bun:test";
import { createHmac, hkdfSync } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { spaceKeysSchema } from "pstdio-sync-contracts";
import { createAuthorityFixture, deviceProfile, provisionAccount } from "./authority.fixture";
import { connectManager } from "./database";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";
import { projectMembers, teamMembers } from "./schema";

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
    await connection.db.transaction(async (transaction) => {
      await transaction.insert(teamMembers).values({ accountId, userId: colleagueId, role: "member" });
      await transaction.insert(projectMembers).values({ ...scope, userId: colleagueId });
    });

    const verify = implementation.createEnvironmentAccessVerifier({
      issuer: config.origin,
      audience: config.audience,
      jwks: await auth.jwks(),
    });
    const renewal = (token: string) => request(token, "/v1/environment-access", scope);
    const access = async (token: string) => {
      const result = await renewal(token);
      expect(result.status).toBe(200);
      const value = (await result.json()) as { token: string; canPublish?: boolean };
      return { grants: await verify(value.token), canPublish: value.canPublish };
    };

    // The owner can renew before any device requests project keys.
    const first = await access(owner.token);
    const keys = spaceKeysSchema.parse(
      await (await request(colleague.token, `${projectPath}/keys?accountId=${accountId}`)).json(),
    );
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

    const membership = (userId: string) => and(eq(teamMembers.accountId, accountId), eq(teamMembers.userId, userId));
    await connection.db.transaction(async (transaction) => {
      await transaction.update(teamMembers).set({ role: "member" }).where(membership(ownerId));
      await transaction.update(teamMembers).set({ role: "owner" }).where(membership(colleagueId));
    });
    expect((await access(owner.token)).canPublish).toBe(false);
    expect((await access(colleague.token)).canPublish).toBe(true);
    await connection.db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.accountId, accountId),
          eq(projectMembers.workbenchId, workbenchId),
          eq(projectMembers.userId, ownerId),
        ),
      );
    expect((await renewal(owner.token)).status).toBe(401);
  } finally {
    await Promise.all([auth.close(), manager.close(), connection.close()]);
  }
});
