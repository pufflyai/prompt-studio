import { afterAll, beforeAll, expect, test } from "bun:test";
import { Client } from "pg";
import { createAssetFixture, newScope, reference } from "./integration-fixture";

const fixture = createAssetFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

for (const operation of ["begin", "finish"] as const) {
  test(`closing interrupts ${operation} while its asset query is blocked by another transaction`, async () => {
    const owner = fixture.owner();
    const blocker = new Client({ connectionString: fixture.config.databaseUrl });
    const observer = new Client({ connectionString: fixture.config.databaseUrl });
    const scope = newScope();
    const asset = reference(new Uint8Array());
    let pending: Promise<unknown> | undefined;
    let closing: Promise<unknown> | undefined;
    try {
      if (operation === "finish") await owner.begin(scope, "locked", asset);
      await blocker.connect();
      await observer.connect();
      await blocker.query("BEGIN");
      await blocker.query("LOCK TABLE relay_asset_uploads IN ACCESS EXCLUSIVE MODE");
      pending = (operation === "begin" ? owner.begin(scope, "locked", asset) : owner.finish(scope, "locked")).catch(
        (error: unknown) => error,
      );
      while (true) {
        const { rows } = await observer.query(
          "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%relay_asset_uploads%'",
        );
        if (rows[0].count > 0) break;
        await Bun.sleep(10);
      }
      closing = owner.close();
      const result = await Promise.race([closing.then(() => "closed"), Bun.sleep(200).then(() => "blocked")]);
      expect(result).toBe("closed");
      expect(await pending).toBeInstanceOf(Error);
    } finally {
      await blocker.query("ROLLBACK").catch(() => {});
      await Promise.allSettled([pending, closing]);
      await Promise.all([blocker.end(), observer.end(), owner.close()]);
    }
  });
}
