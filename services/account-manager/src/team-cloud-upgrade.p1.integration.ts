import { expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { createAuthorityFixture } from "./authority.fixture";
import { createCredential, digestCredential } from "./credential";
import { connectManager } from "./database";
import * as implementation from "./index";
import { authenticationConfig } from "./manager-authentication.fixture";
import { fixtureMicrosoftClient } from "./oauth-code.fixture";

const migrations = resolve(import.meta.dir, "../drizzle");
const stageSchema = async (directory: string, last: number) => {
  const journal = await Bun.file(join(migrations, "meta/_journal.json")).json();
  const entries: { tag: string }[] = journal.entries.slice(0, last + 1);
  await mkdir(join(directory, "meta"));
  await Promise.all([
    writeFile(join(directory, "meta/_journal.json"), JSON.stringify({ ...journal, entries })),
    ...entries.map(({ tag }) => copyFile(join(migrations, `${tag}.sql`), join(directory, `${tag}.sql`))),
  ]);
};

// Seed the schema that actually shipped, without calling newer writers against older tables.
const seedPreviousData = async (db: ReturnType<typeof connectManager>["db"], last: number) => {
  const token = createCredential();
  const memberToken = createCredential();
  const keys = {
    project: [1, 2].map((generation) => ({ generation, secret: createCredential() })),
    personal: [1, 2].map((generation) => ({ generation, secret: createCredential() })),
  };
  const sharedKey = createCredential();
  for (const [id, credential] of [
    ["upgrade-owner", token],
    ["upgrade-member", memberToken],
  ] as const) {
    await db.execute(sql`insert into manager_accounts (id, "ownerIssuer", "ownerSubject", state)
      values (${id}, 'https://accounts.google.com', ${id}, 'active')`);
    await db.execute(sql`insert into manager_devices ("accountId", id, name, platform, digest)
      values (${id}, 'existing-device', 'Existing device', 'linux', ${digestCredential(credential)})`);
    await db.execute(sql`insert into manager_account_features ("accountId", feature) values (${id}, 'relay')`);
  }
  await db.execute(sql`insert into manager_workbenches ("accountId", id) values ('upgrade-owner', 'personal')`);
  for (const space of ["project", "personal"] as const) {
    for (const { generation, secret } of keys[space]) {
      await db.execute(sql`insert into manager_space_keys ("accountId", "workbenchId", space, generation, secret)
        values ('upgrade-owner', 'personal', ${space}, ${generation}, ${secret})`);
    }
  }
  if (last === 7) {
    await db.execute(sql`insert into manager_accounts (id, state) values ('existing-team', 'active')`);
    await db.execute(sql`insert into manager_teams ("accountId", name) values ('existing-team', 'Existing team')`);
    await db.execute(
      sql`insert into manager_account_features ("accountId", feature) values ('existing-team', 'relay')`,
    );
    await db.execute(sql`insert into manager_team_members ("accountId", "userId", role)
      values ('existing-team', 'upgrade-owner', 'owner'), ('existing-team', 'upgrade-member', 'member')`);
    await db.execute(sql`insert into manager_workbenches ("accountId", id) values ('existing-team', 'shared')`);
    await db.execute(sql`insert into manager_project_members ("accountId", "workbenchId", "userId")
      values ('existing-team', 'shared', 'upgrade-owner'), ('existing-team', 'shared', 'upgrade-member')`);
    await db.execute(sql`insert into manager_space_keys ("accountId", "workbenchId", space, generation, secret)
      values ('existing-team', 'shared', 'project', 1, ${sharedKey})`);
  }
  return { token, memberToken, keys, sharedKey };
};

for (const last of [6, 7]) {
  test(`Cloud upgrade from migration ${last} preserves devices, keys and existing grants`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "manager-before-team-management-"));
    const fixture = createAuthorityFixture(implementation);
    const db = connectManager(fixture.databaseUrl);
    const config = authenticationConfig(fixture.databaseUrl);
    let auth = implementation.createManagerAuthentication(config);
    try {
      await stageSchema(directory, last);
      await fixture.initialize(directory);
      const { token, memberToken, keys: previousKeys, sharedKey } = await seedPreviousData(db.db, last);
      const signingKeys = await auth.jwks();
      expect(signingKeys.keys.length).toBeGreaterThan(0);
      await auth.close();
      await implementation.migrateAccountManager(fixture.databaseUrl, migrations);
      await implementation.migrateAccountManager(fixture.databaseUrl, migrations);
      auth = implementation.createManagerAuthentication({ ...config, microsoft: fixtureMicrosoftClient });
      const handler = implementation.createManagerHandler(auth, config.origin);
      const request = (path: string, credential = token, body?: unknown) =>
        handler(
          new Request(config.origin + path, {
            method: body === undefined ? "GET" : "POST",
            headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
          }),
        );
      expect(await auth.jwks()).toEqual(signingKeys);
      expect(await (await request("/v1/sign-in-providers")).json()).toEqual({ microsoft: true });
      expect(await (await request("/v1/workbenches")).json()).toEqual([{ workbenchId: "personal" }]);
      const personal = await request("/v1/workbenches/personal/keys");
      expect(personal.status).toBe(200);
      expect(await personal.json()).toEqual(previousKeys);

      if (last === 7) {
        const grants: string[] = [];
        for (const credential of [token, memberToken]) {
          const response = await request("/v1/workbenches?accountId=existing-team", credential);
          expect(response.status).toBe(200);
          const [project] = await response.json();
          expect(project.workbenchId).toBe("shared");
          expect(project.grantId).toMatch(/^[0-9a-f-]{36}$/);
          grants.push(project.grantId);
          const keys = await request(
            `/v1/workbenches/shared/keys?accountId=existing-team&grantId=${project.grantId}`,
            credential,
          );
          expect(keys.status).toBe(200);
          expect((await keys.json()).project).toEqual([{ generation: 1, secret: sharedKey }]);
        }
        expect(new Set(grants).size).toBe(2);
      }

      const created = await request("/v1/teams", token, { name: "New team" });
      expect(created.status).toBe(201);
      const { accountId } = await created.json();
      const invitation = await request(`/v1/teams/${accountId}/invite-codes`, token, {});
      expect(invitation.status).toBe(201);
      const { code } = await invitation.json();
      const accepted = await request("/v1/team-invitations/accept", memberToken, { secret: code });
      expect(accepted.status).toBe(200);
      expect(await (await request(`/v1/workbenches?accountId=${accountId}`, memberToken)).json()).toEqual([]);
      expect(await (await request(`/v1/teams/${accountId}/managed-extensions`, memberToken)).json()).toEqual([]);
    } finally {
      await Promise.all([auth.close(), db.close(), fixture.close()]);
      await rm(directory, { recursive: true, force: true });
    }
  });
}
