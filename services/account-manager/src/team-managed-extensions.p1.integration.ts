import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createAuthorityFixture, deviceProfile } from "./authority.fixture";
import * as implementation from "./index";
import { createAuthenticationFixture } from "./manager-authentication.fixture";

const fixture = createAuthorityFixture(implementation);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("only the owner selects immutable team packages; project grants gate package keys and bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "team-packages-"));
  // Real filesystem bytes exercise the object boundary here; deployed E2E also covers S3.
  const objects = {
    reserve: async (id: string) => id,
    write: async (id: string, _uploadId: string, bytes: Uint8Array) => {
      await writeFile(join(directory, id), bytes, { flag: "wx" });
    },
    read: async (id: string) => new Uint8Array(await Bun.file(join(directory, id)).arrayBuffer()),
    remove: (id: string) => rm(join(directory, id), { force: true }),
    close: () => {},
  };
  const authentication = createAuthenticationFixture(fixture.databaseUrl);
  const auth = implementation.createManagerAuthentication(authentication.config, objects);
  const manager = fixture.owner();
  const handler = implementation.createManagerHandler(auth, authentication.config.origin);
  const request = (token: string, path: string, body?: unknown, headers?: HeadersInit) =>
    handler(
      new Request(authentication.config.origin + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...Object.fromEntries(new Headers(headers)),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const device = async () => {
    const login = await authentication.login(crypto.randomUUID());
    return auth.loginDevice(login.headers, deviceProfile());
  };
  try {
    const owner = await device();
    const member = await device();
    const outsider = await device();
    const { accountId } = await (await request(owner.token, "/v1/teams", { name: "Managed tools" })).json();
    const team = `/v1/teams/${accountId}`;
    const policy = `${team}/managed-extensions`;
    const initial = await request(owner.token, policy);
    expect(initial.status).toBe(200);
    expect(await initial.json()).toEqual([]);
    const { code } = await (await request(owner.token, `${team}/invite-codes`, {})).json();
    await request(member.token, "/v1/team-invitations/accept", { secret: code });
    await manager.setFeature({ accountId, feature: "relay", enabled: true });
    await request(owner.token, `/v1/workbenches/source?accountId=${accountId}`, {});
    await request(owner.token, `/v1/workbenches/recipient?accountId=${accountId}`, {});
    await request(owner.token, `${team}/projects/recipient/access`, { userId: member.accountId, granted: true });

    const bytes = crypto.getRandomValues(new Uint8Array(64));
    const metadata = {
      extensionId: "fixture.private-tool",
      name: "Private tool",
      version: "1.0.0",
      revision: "a".repeat(64),
      secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
      blobId: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url"),
      cipherSha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
      byteLength: bytes.length,
      expectedSelection: null,
    };
    const upload = (token: string, descriptor = metadata, payload = bytes) =>
      handler(
        new Request(authentication.config.origin + `${policy}/packages`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/octet-stream",
            "x-pstdio-package": Buffer.from(JSON.stringify(descriptor)).toString("base64url"),
          },
          body: payload,
        }),
      );
    expect((await upload(member.token)).status).toBe(403);
    expect((await upload(outsider.token)).status).toBe(401);
    expect((await upload(owner.token, metadata, new Uint8Array(64))).status).toBe(400);
    const installed = await upload(owner.token);
    expect(installed.status).toBe(201);
    const selection = await installed.json();
    expect(selection).toMatchObject({
      extensionId: metadata.extensionId,
      revision: metadata.revision,
      selectionId: expect.any(String),
    });
    const publicPolicy = await (await request(member.token, policy)).json();
    expect(publicPolicy).toEqual([selection]);
    expect(JSON.stringify(publicPolicy)).not.toContain(metadata.secret);
    expect(JSON.stringify(publicPolicy)).not.toContain(metadata.blobId);
    expect(JSON.stringify(publicPolicy)).not.toContain("source");
    const [{ grantId }] = await (await request(member.token, `/v1/workbenches?accountId=${accountId}`)).json();
    const packagePath = `${policy}/${metadata.extensionId}/package?workbenchId=recipient&grantId=${grantId}&selectionId=${selection.selectionId}`;
    expect((await request(outsider.token, packagePath)).status).toBe(401);
    const download = await request(member.token, packagePath);
    expect(download.status).toBe(200);
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes);
    const descriptor = JSON.parse(Buffer.from(download.headers.get("x-pstdio-package")!, "base64url").toString());
    expect(descriptor.secret).toBe(metadata.secret);
    expect(
      (await request(member.token, packagePath.replace("workbenchId=recipient", "workbenchId=source"))).status,
    ).toBe(403);
    expect((await upload(owner.token, { ...metadata, revision: "b".repeat(64) })).status).toBe(409);
    expect((await upload(owner.token)).status).toBe(201);
    expect(await (await request(owner.token, policy)).json()).toEqual([selection]);
    const rows = await authentication.connection.db.execute(sql`select * from manager_team_managed_packages`);
    expect(rows.rows).toHaveLength(1);
    expect(JSON.stringify(rows.rows)).not.toContain(Buffer.from(bytes).toString("base64"));
    expect(JSON.stringify(await manager.snapshot())).toContain(metadata.secret);
    expect(
      (
        await request(member.token, `${policy}/${metadata.extensionId}/remove`, {
          expectedSelection: selection.selectionId,
        })
      ).status,
    ).toBe(403);
    await request(owner.token, `${team}/projects/recipient/access`, { userId: member.accountId, granted: false });
    expect((await request(member.token, packagePath)).status).toBe(403);
    expect(
      (await request(owner.token, `${policy}/${metadata.extensionId}/remove`, { expectedSelection: "stale" })).status,
    ).toBe(409);
    expect(
      (
        await request(owner.token, `${policy}/${metadata.extensionId}/remove`, {
          expectedSelection: selection.selectionId,
        })
      ).status,
    ).toBe(200);
    expect(await (await request(member.token, policy)).json()).toEqual([]);
  } finally {
    await Promise.all([auth.close(), authentication.close(), manager.close()]);
    await rm(directory, { recursive: true, force: true });
  }
});
