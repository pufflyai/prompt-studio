import { afterAll, beforeAll, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import { connectRelay } from "./database";
import { syncObjectDeletions } from "./document-schema";
import { cleanupPayloads } from "./payload-cleanup";
import { createPayloadObjects } from "./payloads";
import { createSyncFixture, randomId } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("partial provider deletion keeps durable retry rows and never removes an unrelated payload", async () => {
  const keys = Array.from({ length: 3 }, () => randomId("retired"));
  const kept = randomId("retained");
  for (const key of [...keys, kept]) await fixture.putLegacyObject(key, new Uint8Array([1, 2, 3]));
  const connection = connectRelay(fixture.databaseUrl);
  let partial = true;
  const proxy = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (
        request.method === "DELETE" &&
        url.pathname.endsWith(`/${keys[1]}`) &&
        !url.searchParams.has("uploadId") &&
        partial
      ) {
        partial = false;
        return new Response("<Error><Code>InternalError</Code><Message>Controlled partial deletion</Message></Error>", {
          status: 500,
          headers: { "content-type": "application/xml" },
        });
      }
      return fetch(`${fixture.s3.endpoint}${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    },
  });
  const payloads = createPayloadObjects({
    bucket: fixture.bucket,
    s3: { ...fixture.s3, endpoint: proxy.url.href },
  });
  const pending = () =>
    connection.run((db) => db.select().from(syncObjectDeletions).where(inArray(syncObjectDeletions.objectKey, keys)));
  try {
    await connection.run((db) => db.insert(syncObjectDeletions).values(keys.map((objectKey) => ({ objectKey }))));
    await expect(cleanupPayloads(connection, payloads)).rejects.toThrow("Controlled partial deletion");
    expect(await pending()).toHaveLength(3);
    const incomplete = await fixture.objects();
    expect(incomplete.has(keys[0]!)).toBe(false);
    expect(incomplete.has(keys[1]!)).toBe(true);
    expect(incomplete.has(kept)).toBe(true);

    await cleanupPayloads(connection, payloads);
    expect(await pending()).toHaveLength(0);
    expect([...(await fixture.objects()).keys()]).toEqual([kept]);
    await cleanupPayloads(connection, payloads);
  } finally {
    payloads.close();
    await connection.close();
    await proxy.stop(true);
  }
});
