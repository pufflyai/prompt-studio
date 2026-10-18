import { afterAll, beforeAll, expect, test } from "bun:test";
import { fingerprint, type RelayOperation, relayAssetStatusSchema, relayPath } from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { withFixtureDatabase } from "./database.fixture";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("HTTP disconnection resumes the same part; HTTP cancellation drains an active streamed writer", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const bytes = new Uint8Array(2 * 1024 * 1024).fill(5);
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    mediaType: "application/octet-stream",
  };
  const call = (operation: RelayOperation, body: unknown) =>
    fetch(new URL(relayPath(context.scope, operation), server.url), {
      method: "POST",
      headers: { authorization: `Bearer ${context.token}` },
      body: JSON.stringify(body),
    });
  const controllers: AbortController[] = [];
  const pending: Promise<unknown>[] = [];
  const part = (id: string, body: ReadableStream<Uint8Array>, signal?: AbortSignal) =>
    fetch(new URL(relayPath(context.scope, "assets/part"), server.url), {
      method: "PUT",
      headers: {
        authorization: `Bearer ${context.token}`,
        "x-pstdio-upload-id": id,
        "x-pstdio-part-number": "1",
        "x-pstdio-sha256": asset.sha256,
        "content-length": String(bytes.length),
      },
      body,
      signal,
    });
  try {
    for (const id of ["disconnect", "cancel"]) {
      expect((await call("assets/begin", { uploadId: id, asset })).status).toBe(200);
      const controller = new AbortController();
      controllers.push(controller);
      let produced = 0;
      const body = new ReadableStream<Uint8Array>(
        {
          pull(stream) {
            if (produced) return new Promise(() => {});
            produced += 64 * 1024;
            stream.enqueue(bytes.subarray(0, produced));
          },
        },
        { highWaterMark: 0 },
      );
      const writing = part(id, body, controller.signal).catch((error: unknown) => error);
      pending.push(writing);
      await withFixtureDatabase(fixture.relayDatabaseUrl, async (client) => {
        while (true) {
          const row = await client.query(
            'SELECT etag FROM relay_asset_parts WHERE "ownerId" = $1 AND "uploadId" = $2',
            [await fingerprint(context.scope), id],
          );
          if (row.rows.length) {
            expect(row.rows[0].etag).toBeNull();
            break;
          }
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
      });
      expect(produced).toBeLessThan(bytes.length);
      if (id === "cancel") expect((await call("assets/cancel", { uploadId: id })).status).toBe(200);
      controller.abort();
      await writing;
      const resumed = await call("assets/begin", { uploadId: id, asset });
      if (id === "cancel") {
        expect(resumed.status).toBe(409);
        continue;
      }
      expect(relayAssetStatusSchema.parse(await resumed.json()).parts).toEqual([]);
      expect((await part(id, new Blob([bytes]).stream())).status).toBe(200);
      expect((await call("assets/finish", { uploadId: id })).status).toBe(200);
      const response = await call("assets/read", { asset, offset: 0 });
      const hash = new Bun.CryptoHasher("sha256");
      for await (const chunk of response.body!) hash.update(chunk);
      expect(hash.digest("hex")).toBe(asset.sha256);
    }
  } finally {
    for (const controller of controllers) controller.abort();
    await Promise.allSettled(pending);
    await server.stop(true);
    await context.close();
  }
});
