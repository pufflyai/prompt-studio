import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createExtensionStorageFixture } from "../services/extension-storage/extension-storage.fixture";
import { withOrderedOwner } from "../services/extension-storage/ordered-journal";
import { saveOrderedMarker } from "../services/extension-storage/ordered-native-metadata";
import { pruneSettledOperations } from "../services/extension-storage/prune-operations";
import { createDb } from "./connection.pglite";
import { createDependencyMarkerCleanup } from "./dependency-marker-upgrade";

test("reopening a consolidated home moves the exact dependency selector and collects only retired files", async () => {
  const root = await mkdtemp(join(tmpdir(), "dependency-selectors-"));
  const path = join(root, "database");
  const fixture = await createExtensionStorageFixture(path);
  const owner = { workbenchId: fixture.projectAId, extensionId: "example.records" };
  const key = (id: string) => JSON.stringify(["ordered-dependency", id]);
  const foreign = 'foreign"save';
  let close: (() => Promise<void>) | undefined = fixture.close;
  try {
    await withOrderedOwner(fixture.db, owner, async (journal, tx) => {
      for (const id of [foreign, "modern", "settled", "damaged"]) {
        for (const [epoch, state] of [
          ["aaa", "accepted"],
          ["zzz", "refused"],
        ] as const)
          await journal.recordDecision({ operationId: id, fingerprint: id, epoch, state }, id);
      }
      await tx.execute(sql`UPDATE operations SET receipt_epoch=NULL WHERE operation_id IN (${foreign},'damaged')`);
      await tx.execute(sql`UPDATE operations SET settled_epoch='zzz',receipt_epoch=NULL WHERE operation_id='settled'`);
      for (const id of [foreign, "modern", "settled", "orphan", "damaged"])
        await saveOrderedMarker(tx, owner, key(id), { epoch: "aaa" });
      await saveOrderedMarker(tx, owner, '["ordered-dependency","extra","component"]', { keep: true });
    });
    const {
      rows: [before],
    } = await fixture.db.execute<{ id: string; state_sha256: string }>(
      sql`SELECT id,state_sha256 FROM documents WHERE key=${key(foreign)}`,
    );
    const head = join(
      `${path}-documents`,
      `p-${Buffer.from(owner.workbenchId).toString("hex")}`,
      String(before!.id),
      `head-${before!.state_sha256}.json`,
    );
    expect(existsSync(head)).toBe(true);
    const damaged = await fixture.db.execute<{ id: string; state_sha256: string }>(
      sql`SELECT id,state_sha256 FROM documents WHERE key=${key("damaged")}`,
    );
    const broken = damaged.rows[0]!;
    await writeFile(
      join(
        `${path}-documents`,
        `p-${Buffer.from(owner.workbenchId).toString("hex")}`,
        String(broken.id),
        `head-${broken.state_sha256}.json`,
      ),
      "corrupt selector",
    );
    await close();
    close = undefined;
    const orphan = join(`${path}-documents`, `p-${Buffer.from(owner.workbenchId).toString("hex")}`, "787878787");
    await mkdir(orphan, { recursive: true });
    await writeFile(join(orphan, "state-orphan.bin"), "unreferenced");
    for (let open = 0; open < 2; open++) {
      const next = await createDb({ path, deferCleanup: true });
      close = next.close;
      if (open === 0) {
        expect(existsSync(head)).toBe(true);
        await withOrderedOwner(next.db, owner, async (journal) => {
          expect((await journal.knownDependency(foreign))?.state).toBe("accepted");
        });
        await next.cleanupRetiredRows(() => true);
        expect(existsSync(orphan)).toBe(true);
        expect(existsSync(head)).toBe(true);
      }
      await next.cleanupRetiredRows(() => false);
      expect(
        (await next.pglite.query("SELECT key FROM documents WHERE starts_with(key,'[\"ordered-dependency\",')")).rows,
      ).toEqual([{ key: '["ordered-dependency","extra","component"]' }]);
      expect(existsSync(head)).toBe(false);
      expect(existsSync(join(orphan, "state-orphan.bin"))).toBe(false);
      await withOrderedOwner(next.db, owner, async (journal) => {
        expect((await journal.knownDependency(foreign))?.state).toBe("accepted");
        expect((await journal.knownDependency("modern"))?.state).toBe("refused");
        expect((await journal.knownDependency("settled"))?.state).toBe("refused");
        expect(await journal.knownDependency("orphan")).toBeUndefined();
        expect(await journal.knownDependency("damaged")).toBeUndefined();
        expect((await journal.cachedDecision("damaged", "aaa"))?.state).toBe("accepted");
      });
      await close();
      close = undefined;
    }
  } finally {
    await close?.();
    await rm(root, { recursive: true, force: true });
  }
});

test("an interrupted page keeps its original selector and resumes after earlier pages committed", async () => {
  const f = await createExtensionStorageFixture();
  const owner = { workbenchId: f.projectAId, extensionId: "example.records" };
  const marker = '["ordered-dependency","last"]';
  try {
    await withOrderedOwner(f.db, owner, async (journal, tx) => {
      await journal.recordDecision(
        { operationId: "last", fingerprint: "last", epoch: "selected", state: "accepted" },
        "receipt",
      );
      await tx.execute(sql`UPDATE operations SET receipt_epoch=NULL WHERE operation_id='last'`);
      await tx.execute(sql`INSERT INTO documents(owner_id,key,kind,state_sha256,state_bytes)
        SELECT o.id,'["ordered-dependency","expired-'||n||'"]','local','unused',0
        FROM owners o CROSS JOIN generate_series(1,1024) n
        WHERE o.project_id=${owner.workbenchId} AND o.extension_id=${owner.extensionId}`);
      await saveOrderedMarker(tx, owner, marker, { epoch: "selected" });
    });
    await f.db.execute(sql`CREATE FUNCTION pg_temp.interrupt_marker() RETURNS trigger LANGUAGE plpgsql AS
      'BEGIN RAISE EXCEPTION ''interrupted marker cleanup''; END'`);
    await f.db.execute(sql`CREATE TRIGGER interrupt_marker BEFORE DELETE ON documents
      FOR EACH ROW WHEN (OLD.key='["ordered-dependency","last"]') EXECUTE FUNCTION pg_temp.interrupt_marker()`);
    const run = createDependencyMarkerCleanup(f.db, async () => {});
    const cleanup = () => run(() => false);
    await expect(cleanup()).rejects.toThrow();
    const remaining = await f.db.execute<{ n: number }>(
      sql`SELECT count(*)::int n FROM documents WHERE starts_with(key,'["ordered-dependency",')`,
    );
    expect(remaining.rows[0]!.n).toBeGreaterThan(0);
    expect(remaining.rows[0]!.n).toBeLessThan(1025);
    expect((await f.db.execute(sql`SELECT receipt_epoch FROM operations WHERE operation_id='last'`)).rows).toEqual([
      { receipt_epoch: null },
    ]);
    await f.db.execute(sql`DROP TRIGGER interrupt_marker ON documents`);
    await cleanup();
    expect((await f.db.execute(sql`SELECT receipt_epoch FROM operations WHERE operation_id='last'`)).rows).toEqual([
      { receipt_epoch: "selected" },
    ]);
    expect(
      (await f.db.execute(sql`SELECT id FROM documents WHERE starts_with(key,'["ordered-dependency",')`)).rows,
    ).toEqual([]);
  } finally {
    await f.close();
  }
});

test("retained foreign operations keep their selected epoch through cleanup and restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "retained-selector-"));
  const path = join(root, "database");
  const fixture = await createExtensionStorageFixture(path);
  const owner = { workbenchId: fixture.projectAId, extensionId: "example.records" };
  let close = fixture.close;
  try {
    const id = "foreign";
    await withOrderedOwner(fixture.db, owner, async (journal, tx) => {
      for (const [epoch, state] of [
        ["aaa", "accepted"],
        ["zzz", "refused"],
      ] as const) {
        const decision = { operationId: id, fingerprint: "a".repeat(64), epoch, state };
        const admissionFingerprint = "b".repeat(64);
        await journal.recordDecision(decision, admissionFingerprint);
        await journal.markIndexed([{ decision, admissionFingerprint }]);
      }
      await tx.execute(sql`UPDATE operations SET receipt_epoch=NULL WHERE operation_id=${id}`);
      await saveOrderedMarker(tx, owner, JSON.stringify(["ordered-dependency", id]), { epoch: "aaa" });
    });
    const check = (db: typeof fixture.db) =>
      withOrderedOwner(db, owner, async (journal) => {
        expect((await journal.knownDependency(id))?.state).toBe("accepted");
        expect((await journal.cachedDecision(id, "zzz"))?.state).toBe("refused");
      });
    await check(fixture.db);
    expect(await pruneSettledOperations(fixture.db, owner, new Date(Date.now() + 10 * 86_400_000))).toBe(1);
    await check(fixture.db);
    await createDependencyMarkerCleanup(fixture.db, async () => {})(() => false);
    expect(
      (await fixture.db.execute(sql`SELECT id FROM documents WHERE key=${JSON.stringify(["ordered-dependency", id])}`))
        .rows,
    ).toEqual([]);
    await check(fixture.db);
    await close();
    const reopened = await createDb({ path });
    close = reopened.close;
    await check(reopened.db);
  } finally {
    await close();
    await rm(root, { recursive: true, force: true });
  }
});
