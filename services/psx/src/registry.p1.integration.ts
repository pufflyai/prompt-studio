import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packExtension } from "pstdio-extensions/distribution";
import { connectPsx, migratePsx } from "./database";
import { createPackageObjects } from "./objects";
import { createPsx } from "./service";

const root = await mkdtemp(join(tmpdir(), "psx-integration-"));
const connection = connectPsx(process.env.SYNC_TEST_DATABASE_URL!);
const objects = await createPackageObjects(
  {
    endpoint: process.env.SYNC_TEST_OBJECT_ENDPOINT!,
    region: "us-east-1",
    bucket: "psx-packages",
    accessKeyId: "conformance-access",
    secretAccessKey: "conformance-secret-only",
  },
  true,
);
const app = createPsx({ database: connection.db, objects, publishToken: "integration-publisher" });
const request = (path: string, init?: RequestInit) => app(new Request(`http://psx.test${path}`, init));
const publish = (bytes: Uint8Array, authorised = true) =>
  request("/api/-/publish", {
    method: "POST",
    headers: authorised ? { authorization: "Bearer integration-publisher" } : {},
    body: bytes as BodyInit,
  });
const pack = async (content: string, version = "0.45.1", publisher = "pstdio") => {
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "notes",
      publisher,
      version,
      main: "extension.ts",
      engines: { pstdio: "^0.2.0" },
    }),
  );
  await writeFile(join(root, "extension.ts"), content);
  return packExtension(root);
};
beforeAll(() => migratePsx(process.env.SYNC_TEST_DATABASE_URL!, join(import.meta.dir, "../drizzle")));
afterAll(async () => {
  await connection.close();
  objects.close();
  await rm(root, { recursive: true, force: true });
});

test("publishes immutable packages, permits identical retries, persists downloads and withdraws versions", async () => {
  const packed = await pack("export default {};");
  expect((await publish(packed.bytes, false)).status).toBe(401);
  expect((await publish(packed.bytes)).status).toBe(201);
  expect((await publish(packed.bytes)).status).toBe(200);
  const releases = await (await request("/api/pstdio/notes/versions")).json();
  expect(releases.versions).toMatchObject([
    { id: "pstdio.notes", version: "0.45.1", sha256: packed.sha256, withdrawn: false },
  ]);
  const download = await request("/api/pstdio/notes/0.45.1/file");
  expect(new Uint8Array(await download.arrayBuffer())).toEqual(packed.bytes);
  expect((await publish((await pack("export default {changed: true};")).bytes)).status).toBe(409);
  expect((await request("/api/pstdio/notes/0.45.1/withdraw", { method: "POST" })).status).toBe(401);
  expect(
    (
      await request("/api/pstdio/notes/0.45.1/withdraw", {
        method: "POST",
        headers: { authorization: "Bearer integration-publisher" },
      })
    ).status,
  ).toBe(200);
  expect((await (await request("/api/pstdio/notes/versions")).json()).versions[0].withdrawn).toBe(true);
  expect((await publish(packed.bytes)).status).toBe(200);
  expect((await (await request("/api/pstdio/notes/versions")).json()).versions[0].withdrawn).toBe(true);
  expect((await publish((await pack("export default {};", "0.45.2", "alice")).bytes)).status).toBe(403);
});

test("concurrent publishers leave one complete immutable release", async () => {
  const first = await pack("export default {winner: 1};", "0.45.3");
  const second = await pack("export default {winner: 2};", "0.45.3");
  const results = await Promise.all([publish(first.bytes), publish(second.bytes)]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  const { versions } = await (await request("/api/pstdio/notes/versions")).json();
  const release = versions.find((version: { version: string }) => version.version === "0.45.3");
  const winner = release.sha256 === first.sha256 ? first : second;
  expect(release.sha256).toBe(winner.sha256);
  const downloaded = await request("/api/pstdio/notes/0.45.3/file");
  expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(winner.bytes);
});
