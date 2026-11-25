import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyOrderedOperation, prepareOrderedOperation, projectOrderedOperation } from "pstdio-sync/records";
import { withOrderedOwner } from "../services/extension-storage/ordered-journal";
import { encodeOrderedJson } from "../services/extension-storage/ordered-sql";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { prepareOrderedOwnerUpgrade } from "./ordered-owner-upgrade";
import { prepareReleasedSaveReceipts } from "./released-save-receipts";

test("the upgrade forgets historical save receipts and remembers decisions learned after upgrade", async () => {
  const root = await mkdtemp(join(tmpdir(), "operation-dependency-upgrade-"));
  const old = await createTextLogOwnerFixture(root);
  let oldClosed = false;
  let current: Awaited<ReturnType<typeof createDb>> | undefined;
  const owner = { workbenchId: "foreign-receipts", extensionId: "example.records" };
  try {
    await old.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
      VALUES ('foreign-receipts','Foreign receipts','FR','2026-11-22','2026-11-22');
      INSERT INTO storage_ordered_owners (workbench_id,extension_id,epoch) VALUES ('foreign-receipts','example.records','current');
      INSERT INTO storage_ordered_operations (workbench_id,extension_id,operation_id,fingerprint)
        VALUES ('foreign-receipts','example.records','foreign-save','identity');
      INSERT INTO storage_ordered_receipts (workbench_id,extension_id,epoch,operation_id,admission_fingerprint,state,indexed)
        VALUES ('foreign-receipts','example.records','aaa','foreign-save','first','accepted',true),
          ('foreign-receipts','example.records','zzz','foreign-save','second','refused',false);
      INSERT INTO storage_documents (workbench_id,extension_id,document_id,state,revision,folded_revision)
        VALUES ('foreign-receipts','example.records','["ordered-dependency","foreign-save"]',
          convert_to('{"epoch":"aaa"}','UTF8'),9,9)`);
    await old.close();
    oldClosed = true;
    current = await createDb({ path: old.path });
    const markers = await current.pglite.query("SELECT key FROM documents WHERE key LIKE '[\"ordered-dependency\",%'");
    expect(markers.rows).toEqual([]);
    expect(await Bun.file(`${old.path}-migration-exports/storage_ordered_receipts.jsonl`).exists()).toBe(false);
    await withOrderedOwner(current.db, owner, async (journal) => {
      expect(await journal.knownDependency("foreign-save")).toBeUndefined();
      // The migration must not republish the discarded historical receipts.
      expect(await journal.unindexed()).toEqual([]);
      expect(await journal.publishedReceipt("foreign-save", "aaa")).toBeUndefined();
      await journal.recordDecision(
        { operationId: "foreign-save", fingerprint: "identity", epoch: "zzz", state: "refused" },
        "second",
      );
      expect((await journal.knownDependency("foreign-save"))?.epoch).toBe("zzz");
    });
    await current.close();
    current = await createDb({ path: old.path });
    await withOrderedOwner(current.db, owner, async (journal) => {
      expect((await journal.knownDependency("foreign-save"))?.epoch).toBe("zzz");
      expect(await journal.cachedDecision("foreign-save", "aaa")).toBeUndefined();
    });
  } finally {
    if (!oldClosed) await old.close();
    await current?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("an offline edit resolves its exact predecessor after an interrupted upgrade", async () => {
  const root = await mkdtemp(join(tmpdir(), "pending-receipt-upgrade-"));
  const old = await createTextLogOwnerFixture(root);
  let current: Awaited<ReturnType<typeof createDb>> | undefined;
  let oldClosed = false;
  const owner = { workbenchId: "offline", extensionId: "example.records" };
  try {
    await old.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
      VALUES ('offline','Offline','OF','2026-11-25','2026-11-25');
      INSERT INTO storage_ordered_owners(workbench_id,extension_id,epoch,joined)
      VALUES ('offline','example.records','cloud',true);`);
    const first = await prepareOrderedOperation(
      { operationId: "first", edits: [{ recordId: "card", replace: { title: "one" } }] },
      new Map(),
    );
    const optimistic = new Map(projectOrderedOperation(new Map(), first).map((record) => [record.recordId, record]));
    const second = await prepareOrderedOperation(
      { operationId: "second", edits: [{ recordId: "card", replace: { title: "two" } }] },
      optimistic,
    );
    for (const id of ["first", "unrelated"]) {
      await old.pglite.query(
        `INSERT INTO storage_ordered_operations(workbench_id,extension_id,operation_id,fingerprint)
        VALUES ('offline','example.records',$1,$2)`,
        [id, first.fingerprint],
      );
      await old.pglite.query(
        `INSERT INTO storage_ordered_receipts(workbench_id,extension_id,epoch,operation_id,admission_fingerprint,state)
        VALUES ('offline','example.records','previous',$1,'binding','accepted')`,
        [id],
      );
      await old.pglite.query(
        `INSERT INTO storage_documents(workbench_id,extension_id,document_id,state,revision,folded_revision)
        VALUES ('offline','example.records',$1,convert_to('{"epoch":"previous"}','UTF8'),1,1)`,
        [JSON.stringify(["ordered-dependency", id])],
      );
    }
    await old.pglite.query(
      `INSERT INTO storage_ordered_operations(workbench_id,extension_id,operation_id,fingerprint,request_fingerprint,envelope)
      VALUES ('offline','example.records','second',$1,'request',$2)`,
      [second.fingerprint, encodeOrderedJson(second)],
    );
    // Simulate a crash before the queue manifest is renamed, then one after ordered rows have been cleared.
    await Bun.write(`${old.path}-ordered-queue-dependencies-upgrade.jsonl.tmp`, "partial");
    const receipts = await prepareReleasedSaveReceipts(old.db, old.path);
    expect(receipts).toBeDefined();
    await prepareOrderedOwnerUpgrade(old.db, old.path, receipts);
    await old.close();
    oldClosed = true;
    current = await createDb({ path: old.path });
    await withOrderedOwner(current.db, owner, async (journal) => {
      expect(await journal.knownDependency("unrelated")).toBeUndefined();
      const decision = await journal.knownDependency("first");
      expect(decision).toMatchObject({ epoch: "previous", state: "accepted", fingerprint: first.fingerprint });
      const [queued] = await journal.pending();
      expect(queued?.operation).toEqual(second);
      const canonical = new Map(
        applyOrderedOperation(new Map(), first, "previous").records.map((record) => [record.recordId, record]),
      );
      const applied = applyOrderedOperation(
        canonical,
        queued!.operation,
        "cloud",
        undefined,
        new Map([["first", decision!]]),
      );
      expect(applied.records[0]?.value).toEqual({ title: "two" });
    });
    expect(await Bun.file(`${old.path}-ordered-queue-dependencies-upgrade.jsonl`).exists()).toBe(false);
  } finally {
    if (!oldClosed) await old.close();
    await current?.close();
    await rm(root, { recursive: true, force: true });
  }
});
