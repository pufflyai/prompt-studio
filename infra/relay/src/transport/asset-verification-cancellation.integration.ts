import { afterAll, beforeAll, expect, test } from "bun:test";
import { Client } from "pg";
import { relayPath, sealMutation } from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("disconnecting publication cancels its separate asset verification query before external unlock", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const blocker = new Client({ connectionString: fixture.relayDatabaseUrl });
  const observer = new Client({ connectionString: fixture.relayDatabaseUrl });
  const controller = new AbortController();
  let publishing: Promise<unknown> | undefined;
  try {
    const asset = {
      sha256: new Bun.CryptoHasher("sha256").update(new Uint8Array()).digest("hex"),
      byteLength: 0,
      mediaType: "application/octet-stream",
    };
    await context.assets.begin(context.scope, "verified", asset);
    await context.assets.finish(context.scope, "verified");
    await blocker.connect();
    await observer.connect();
    await blocker.query("BEGIN");
    await blocker.query("LOCK TABLE relay_verified_assets IN ACCESS EXCLUSIVE MODE");
    const mutation = await sealMutation({
      protocolVersion: 1,
      scope: context.scope,
      environmentId: context.environmentId,
      operationId: "asset-publication",
      parents: [],
      changes: [{ recordId: "asset", expectedRevision: 0, baseDeleted: false, asset: { base: null, next: asset } }],
    });
    publishing = fetch(new URL(relayPath(context.scope, "submit"), server.url), {
      method: "POST",
      headers: { authorization: `Bearer ${context.token}`, "content-type": "application/json" },
      body: JSON.stringify(mutation),
      signal: controller.signal,
    }).catch((error: unknown) => error);
    await fixture.waitForBlockedData();
    controller.abort();
    expect(await publishing).toBeInstanceOf(Error);
    const drained = async () => {
      while (true) {
        const result = await observer.query(
          "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
        );
        if (result.rows[0].count === 0) return "drained";
        await Bun.sleep(10);
      }
    };
    expect(await Promise.race([drained(), Bun.sleep(200).then(() => "blocked")])).toBe("drained");
  } finally {
    controller.abort();
    await blocker.query("ROLLBACK").catch(() => {});
    await publishing;
    await Promise.all([server.stop(true), context.close(), blocker.end(), observer.end()]);
  }
});
