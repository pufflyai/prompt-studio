import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createAssetTransfersDBService } from "../services/asset-transfers/asset-transfers";
import { prepareAssetOwnerUpgrade } from "./asset-owner-upgrade";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { assetTransfers, owners } from "./schemas.pg";

for (const interruption of ["normal", "schema", "restore"])
  test(`asset transfers preserve upload identity and cancellation after ${interruption} owner upgrade`, async () => {
    const root = await mkdtemp(join(tmpdir(), "asset-owner-upgrade-"));
    // The preceding format retains its original upgrade contract. The 0.48 cutoff is exercised in batch-reimport.
    const previous = await createTextLogOwnerFixture(root, 6);
    let previousClosed = false;
    let store: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      await previous.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
        VALUES ('project-a','A','A','2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z'),
        ('project-b','B','B','2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z');
        INSERT INTO asset_transfers (project_id,extension_id,operation_id,expected,cancelled_at,created_at)
        SELECT 'project-a','example.assets','operation-' || n,
          jsonb_build_object('sha256',repeat('a',64),'byteLength',n,'mediaType','text/plain'),
          CASE WHEN n % 3 = 0 THEN '2026-11-20T12:01:00.000Z' ELSE NULL END, '2026-11-20T12:00:00.000Z'
        FROM generate_series(0,200) n;
        INSERT INTO asset_transfers SELECT 'project-b',extension_id,operation_id,expected,NULL,created_at
          FROM asset_transfers WHERE operation_id='operation-0';
        INSERT INTO asset_transfers SELECT 'project-a','example.other',operation_id,expected,NULL,created_at
          FROM asset_transfers WHERE project_id='project-a' AND operation_id='operation-0';`);
      const original = (
        await previous.pglite.query<
          Omit<typeof assetTransfers.$inferSelect, "owner_id"> & { project_id: string; extension_id: string }
        >("SELECT * FROM asset_transfers ORDER BY project_id,extension_id,operation_id")
      ).rows;
      if (interruption !== "normal") {
        const finish = await prepareAssetOwnerUpgrade(previous.db, previous.path);
        expect((await previous.pglite.query("SELECT * FROM asset_transfers")).rows).toEqual([]);
        await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
        if (interruption === "restore") {
          await previous.pglite.exec(`CREATE FUNCTION stop_asset_restore() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.operation_id='operation-99' THEN RAISE EXCEPTION 'stop restoration'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER stop_asset_restore BEFORE INSERT ON asset_transfers FOR EACH ROW EXECUTE FUNCTION stop_asset_restore()`);
          await expect(finish!()).rejects.toThrow("Failed query");
          expect((await previous.pglite.query("SELECT 1 FROM asset_transfers LIMIT 1")).rows).toHaveLength(0);
          // Reopen the retained snapshot and interrupt its row-by-row recovery after the first batch commits.
          const resume = await prepareAssetOwnerUpgrade(previous.db, previous.path);
          await expect(resume!()).rejects.toThrow("Failed query");
          const partial = await previous.pglite.query<{ count: number }>(
            "SELECT count(*)::int AS count FROM asset_transfers",
          );
          expect(partial.rows[0]!.count).toBe(200);
          const input = (await readFile(`${previous.path}-asset-transfer-owners-upgrade.jsonl`, "utf8"))
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line));
          expect(input).toEqual(original);
          await previous.pglite.exec("DROP TRIGGER stop_asset_restore ON asset_transfers");
        }
      }
      await previous.close();
      previousClosed = true;
      store = await createDb({ path: previous.path });
      const restored = () =>
        store!.db
          .select({
            project_id: owners.project_id,
            extension_id: owners.extension_id,
            operation_id: assetTransfers.operation_id,
            expected: assetTransfers.expected,
            cancelled_at: assetTransfers.cancelled_at,
            created_at: assetTransfers.created_at,
          })
          .from(assetTransfers)
          .innerJoin(owners, eq(assetTransfers.owner_id, owners.id))
          .orderBy(owners.project_id, owners.extension_id, assetTransfers.operation_id);
      expect(await restored()).toEqual(original);
      const owner = { workbenchId: "project-a", extensionId: "example.assets" };
      const transfers = createAssetTransfersDBService(store.db);
      expect((await transfers.get(owner, "operation-0"))?.cancelled_at).toBe("2026-11-20T12:01:00.000Z");
      expect((await transfers.get({ ...owner, workbenchId: "project-b" }, "operation-0"))?.cancelled_at).toBeNull();
      expect((await transfers.get({ ...owner, extensionId: "example.other" }, "operation-0"))?.cancelled_at).toBeNull();
      const retained = (await transfers.get(owner, "operation-1"))!;
      expect(
        await transfers.begin(owner, "operation-1", {
          sha256: "b".repeat(64),
          byteLength: 99,
          mediaType: "text/plain",
        }),
      ).toEqual(retained);
      const archive = (await readFile(`${previous.path}-migration-exports/asset-transfers.jsonl`, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(archive).toEqual(original);
      await store.close();
      store = await createDb({ path: previous.path });
      expect(await restored()).toEqual(original);
      expect(await Bun.file(`${previous.path}-asset-transfer-owners-upgrade.jsonl`).exists()).toBe(false);
    } finally {
      if (!previousClosed) await previous.close();
      await store?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
