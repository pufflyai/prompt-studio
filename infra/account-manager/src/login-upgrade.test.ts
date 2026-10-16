import { afterAll, beforeAll, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuthorityFixture, provisionAccount, registration } from "./authority.fixture";
import * as implementation from "./index";

const fixture = createAuthorityFixture(implementation);
const migrations = new URL("../drizzle/", import.meta.url).pathname;
let original: string;
beforeAll(async () => {
  original = await mkdtemp(join(tmpdir(), "manager-login-upgrade-"));
  await mkdir(join(original, "meta"));
  const journal = await Bun.file(join(migrations, "meta/_journal.json")).json();
  const initial = journal.entries[0];
  await copyFile(join(migrations, `${initial.tag}.sql`), join(original, `${initial.tag}.sql`));
  await Bun.write(join(original, "meta/_journal.json"), JSON.stringify({ ...journal, entries: [initial] }));
  await fixture.initialize(original);
});
afterAll(async () => {
  await fixture.close();
  await rm(original, { recursive: true, force: true });
});

test("existing environment authority survives the login schema upgrade", async () => {
  const owner = fixture.owner();
  const reopened = fixture.owner();
  try {
    const accountId = await provisionAccount(owner);
    const grant = await owner.register(registration(accountId));
    await implementation.migrateAccountManager(fixture.databaseUrl, migrations);
    expect(await reopened.authorize(grant.token!, grant.workbenchId)).toEqual({
      accountId,
      workbenchId: grant.workbenchId,
      environmentId: grant.environmentId,
    });
    const challenge = await reopened.beginLogin({ expiresAt: new Date(Date.now() + 60_000).toISOString() });
    expect(await reopened.loginChallenge(challenge.state, challenge.binding)).toEqual({ nonce: challenge.nonce });
  } finally {
    await Promise.all([owner.close(), reopened.close()]);
  }
});
