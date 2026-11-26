import { afterAll, beforeAll, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";
import { lockAccount } from "./transactions";

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
    return { ...(await auth.loginDevice(login.headers, deviceProfile())), subject: login.subject };
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
    const morganLogin = await authentication.login(crypto.randomUUID(), morganEmail);
    const morgan = await auth.loginDevice(morganLogin.headers, deviceProfile());
    const oldMorganDevice = await auth.loginDevice(morganLogin.headers, deviceProfile());
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
    const grantIdFor = async (token: string, id: string) => {
      const rows = await catalog(token);
      return Array.isArray(rows) ? rows.find(({ workbenchId }) => workbenchId === id)?.grantId : undefined;
    };
    const keys = async (token: string, id: string) =>
      request(token, `/v1/workbenches/${id}/keys${query}&grantId=${(await grantIdFor(token, id)) ?? ""}`);
    const renew = async (token: string, workbenchId: string, grantId?: string) =>
      request(token, "/v1/environment-access", {
        accountId,
        workbenchId,
        grantId: grantId ?? (await grantIdFor(token, workbenchId)),
      });
    const grant = (project: string, userId: string, granted: boolean, token = alex.token) =>
      request(token, `${team}/projects/${project}/access`, { userId, granted });

    expect((await add("project-a")).status).toBe(200);
    expect((await add("project-b")).status).toBe(200);
    expect(await catalog(morgan.token)).toEqual([]);
    expect((await grant("project-a", morgan.accountId, true, morgan.token)).status).toBe(403);
    expect((await grant("project-a", "outsider", true)).status).toBe(403);
    expect((await grant("project-a", morgan.accountId, true)).status).toBe(200);
    expect(await (await request(morgan.token, `${team}/projects`)).json()).toEqual([
      { workbenchId: "project-a", userIds: [alex.accountId, morgan.accountId].sort() },
    ]);
    expect(await (await request(alex.token, `${team}/projects`)).json()).toEqual([
      { workbenchId: "project-a", userIds: [alex.accountId, morgan.accountId].sort() },
      { workbenchId: "project-b", userIds: [alex.accountId] },
    ]);
    expect(await catalog(morgan.token)).toEqual([{ workbenchId: "project-a", grantId: expect.any(String) }]);
    expect(await catalog(casey.token)).toEqual([]);
    expect((await keys(morgan.token, "project-b")).status).toBe(404);
    expect((await renew(casey.token, "project-a")).status).toBe(401);
    expect((await renew(morgan.token, "project-a")).status).toBe(200);
    const alexBefore = await (await keys(alex.token, "project-a")).json();
    const morganBefore = await (await keys(morgan.token, "project-a")).json();
    const projectBBefore = await (await keys(alex.token, "project-b")).json();
    expect(morganBefore.project).toEqual(alexBefore.project);
    expect(morganBefore.personal).not.toEqual(alexBefore.personal);

    const beforeRevocation = await manager.snapshot();
    const currentGrant = (await grantIdFor(morgan.token, "project-a")) as string;
    const locked = Promise.withResolvers<void>();
    const fence = authentication.connection.db.transaction(async (transaction) => {
      await lockAccount(transaction, morgan.accountId);
      locked.resolve();
      // Renewal prepares its signature before it queues on the person's account.
      const end = Date.now() + 2000;
      for (;;) {
        const waiting = await transaction.execute<{ waiting: boolean }>(sql`
          select exists (
            select 1 from pg_locks
            where locktype = 'advisory' and classid = 1
              and objid = hashtext(${morgan.accountId})::oid and not granted
          ) as waiting
        `);
        if (waiting.rows[0]?.waiting) break;
        if (Date.now() >= end) throw new Error("Renewal did not reach the delivery fence");
        await Bun.sleep(5);
      }
      expect((await grant("project-a", morgan.accountId, false)).status).toBe(200);
    });
    const pendingRenewal = locked.promise.then(() => renew(morgan.token, "project-a", currentGrant));
    await fence;
    expect((await pendingRenewal).status).toBe(401);
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
    expect(await catalog(alex.token)).toEqual([{ workbenchId: "project-b", grantId: expect.any(String) }]);
    expect((await add("project-a")).status).toBe(403);
    expect((await keys(alex.token, "project-a")).status).toBe(404);
    expect((await request(alex.token, `${team}/projects`)).status).toBe(200);
    expect((await grant("project-a", alex.accountId, true)).status).toBe(200);
    expect((await grant("project-b", morgan.accountId, true)).status).toBe(200);
    const morganB = await (await keys(morgan.token, "project-b")).json();
    expect((await renew(oldMorganDevice.token, "project-b")).status).toBe(200);
    expect((await request(morgan.token, `/v1/devices/${oldMorganDevice.deviceId}/remove`, {})).status).toBe(200);
    expect((await renew(oldMorganDevice.token, "project-b")).status).toBe(401);
    const afterDeviceRemovalA = await (await keys(alex.token, "project-a")).json();
    const afterDeviceRemovalB = await (await keys(morgan.token, "project-b")).json();
    expect(afterDeviceRemovalA.project).toHaveLength(3);
    expect(afterDeviceRemovalB.project).toHaveLength(2);
    expect(afterDeviceRemovalB.personal).toEqual([...morganB.personal, { generation: 2, secret: expect.any(String) }]);
    expect((await (await keys(alex.token, "project-b")).json()).personal).toEqual(projectBBefore.personal);
    expect((await request(morgan.token, `${team}/leave`, {})).status).toBe(200);
    expect((await renew(morgan.token, "project-b")).status).toBe(401);
    expect((await (await keys(alex.token, "project-b")).json()).project).toHaveLength(3);
    expect((await (await keys(alex.token, "project-a")).json()).project).toHaveLength(3);

    await join(morganEmail, morgan.token);
    expect((await grant("project-b", morgan.accountId, true)).status).toBe(200);
    const [{ grantId: beforePause }] = await catalog(morgan.token);
    const sharedBeforePause = (await (await keys(morgan.token, "project-b")).json()).project;
    expect((await request(alex.token, `/v1/workbenches/project-b/remove${query}`, {})).status).toBe(200);
    expect((await add("project-b")).status).toBe(403);
    expect((await request(alex.token, `/v1/workbenches/project-b${query}`, { grantSelf: true })).status).toBe(200);
    expect((await keys(morgan.token, "project-b")).status).toBe(404);
    expect((await (await keys(alex.token, "project-b")).json()).project).toEqual([
      ...sharedBeforePause,
      { generation: 4, secret: expect.any(String) },
    ]);
    expect((await grant("project-b", morgan.accountId, true)).status).toBe(200);
    const [{ grantId: afterPause }] = await catalog(morgan.token);
    expect(afterPause).not.toBe(beforePause);
    expect((await renew(morgan.token, "project-b", beforePause)).status).toBe(401);
    expect((await renew(morgan.token, "project-b", afterPause)).status).toBe(200);
    expect(
      (await request(morgan.token, "/v1/environment-access", { accountId, workbenchId: "project-b" })).status,
    ).toBe(401);
    const staleKeys = `/v1/workbenches/project-b/keys${query}&grantId=${beforePause}`;
    expect((await request(morgan.token, staleKeys)).status).toBe(404);
    expect((await grant("project-b", morgan.accountId, false)).status).toBe(200);

    await manager.restore("restore-before-revocation", beforeRevocation);
    const reopen = async (id: string, subject?: string) =>
      manager.reconcile({
        requestId: `restore-${id}`,
        accountId: id,
        state: "active",
        ...(subject && { owner: { issuer: "https://accounts.google.com", subject } }),
      });
    await reopen(alex.accountId, alex.subject);
    await reopen(morgan.accountId, morganLogin.subject);
    await reopen(accountId);
    const morganAfterRestore = await manager.registerDevice({ accountId: morgan.accountId, ...deviceProfile() });
    expect((await renew(morganAfterRestore.token, "project-a")).status).toBe(401);
    expect((await renew(morganAfterRestore.token, "project-b")).status).toBe(401);
    const alexAfterRestore = await manager.registerDevice({ accountId: alex.accountId, ...deviceProfile() });
    expect((await (await keys(alexAfterRestore.token, "project-b")).json()).project).toHaveLength(5);
  } finally {
    await Promise.all([manager.close(), authentication.close()]);
  }
});
