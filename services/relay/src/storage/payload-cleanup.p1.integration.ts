import { afterAll, beforeAll, expect, test } from "bun:test";
import { inArray, sql } from "drizzle-orm";
import { connectRelay } from "./database";
import { syncObjectDeletions } from "./document-schema";
import { cleanupPayloads } from "./payload-cleanup";
import { createPayloadObjects } from "./payloads";
import { projectAdvisoryKey } from "./project-access";
import { createSyncFixture, randomId } from "./sync-fixture";

const fixture = createSyncFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("database failures stop cleanup without retrying every remaining batch", async () => {
  const connection = connectRelay(fixture.databaseUrl);
  const prefix = randomId("database-failure");
  const keys = Array.from({ length: 17 }, (_, index) => `${prefix}-${index.toString().padStart(2, "0")}`);
  const failure = new Error("Controlled cleanup database failure");
  const payloads = createPayloadObjects({ bucket: fixture.bucket, s3: fixture.s3 });
  let attempts = 0;
  let removals = 0;
  const brokenConnection = {
    ...connection,
    run: ((action, signal) => {
      if (++attempts > 1) return Promise.reject(failure);
      return connection.run(action, signal);
    }) satisfies typeof connection.run,
  };
  try {
    await connection.run((db) => db.insert(syncObjectDeletions).values(keys.map((objectKey) => ({ objectKey }))));
    await expect(
      cleanupPayloads(brokenConnection, {
        ...payloads,
        async remove() {
          removals++;
        },
      }),
    ).rejects.toBe(failure);
    expect(attempts).toBe(2);
    expect(removals).toBe(0);
    const queued = await connection.run((db) =>
      db.select().from(syncObjectDeletions).where(inArray(syncObjectDeletions.objectKey, keys)),
    );
    expect(queued).toHaveLength(keys.length);
  } finally {
    await connection.run((db) => db.delete(syncObjectDeletions).where(inArray(syncObjectDeletions.objectKey, keys)));
    payloads.close();
    await connection.close();
  }
});

test("provider deletion failures retain retry rows and exclusion while independent projects can finish", async () => {
  const prefix = randomId("retired");
  const held = `${prefix}-a`;
  const healthy = `${prefix}-b`;
  const failing = `${prefix}-c`;
  const keys = [held, healthy, failing];
  const projectKey = randomId("project");
  const healthyProjectKey = randomId("project");
  const kept = randomId("retained");
  for (const key of [...keys, kept]) await fixture.putLegacyObject(key, new Uint8Array([1, 2, 3]));
  const connection = connectRelay(fixture.databaseUrl);
  const writer = connectRelay(fixture.databaseUrl);
  const heldStarted = Promise.withResolvers<void>();
  const releaseHeld = Promise.withResolvers<void>();
  const deleteFailed = Promise.withResolvers<void>();
  let partial = true;
  const proxy = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === "DELETE" && !url.searchParams.has("uploadId")) {
        if (url.pathname.endsWith(`/${held}`)) {
          heldStarted.resolve();
          await releaseHeld.promise;
        }
        if (url.pathname.endsWith(`/${failing}`) && partial) {
          await heldStarted.promise;
          partial = false;
          return new Response(
            "<Error><Code>InternalError</Code><Message>Controlled partial deletion</Message></Error>",
            {
              status: 500,
              headers: { "content-type": "application/xml" },
            },
          );
        }
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
  let cleaning: ReturnType<typeof cleanupPayloads> | undefined;
  let waitingTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await connection.run((db) =>
      db.insert(syncObjectDeletions).values([
        { objectKey: held, projectKey },
        { objectKey: healthy, projectKey: healthyProjectKey },
        { objectKey: failing, projectKey },
      ]),
    );
    cleaning = cleanupPayloads(connection, {
      ...payloads,
      async remove(key, signal) {
        try {
          await payloads.remove(key, signal);
        } catch (error) {
          if (key === failing) deleteFailed.resolve();
          throw error;
        }
      },
    });
    void cleaning.catch(() => {});

    await Promise.race([
      deleteFailed.promise,
      cleaning,
      new Promise<never>((_, reject) => {
        waitingTimeout = setTimeout(
          () => reject(new Error("Concurrent deletion did not reach the controlled failure while the first was held")),
          2_000,
        );
      }),
    ]);
    clearTimeout(waitingTimeout);
    await expect(
      writer.run((db) =>
        db.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL lock_timeout = 250`);
          await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(${projectAdvisoryKey(projectKey)})`);
        }),
      ),
    ).rejects.toMatchObject({ cause: { code: "55P03" } });
    releaseHeld.resolve();

    await expect(cleaning).rejects.toThrow("Controlled partial deletion");
    expect((await pending()).map(({ objectKey }) => objectKey).sort()).toEqual([held, failing]);
    const incomplete = await fixture.objects();
    expect(incomplete.has(held)).toBe(false);
    expect(incomplete.has(healthy)).toBe(false);
    expect(incomplete.has(failing)).toBe(true);
    expect(incomplete.has(kept)).toBe(true);

    await cleanupPayloads(connection, payloads);
    expect(await pending()).toHaveLength(0);
    expect([...(await fixture.objects()).keys()]).toEqual([kept]);
    await cleanupPayloads(connection, payloads);
  } finally {
    clearTimeout(waitingTimeout);
    releaseHeld.resolve();
    await cleaning?.catch(() => {});
    payloads.close();
    await Promise.all([connection.close(), writer.close()]);
    await proxy.stop(true);
  }
});
