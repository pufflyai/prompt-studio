import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withOrderedOwner } from "../services/extension-storage/ordered-journal";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";

test("a released foreign receipt keeps its selected epoch until a new exact decision is learned", async () => {
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
    const expected = { epoch: "aaa", operationId: "foreign-save", fingerprint: "identity", state: "accepted" as const };
    await withOrderedOwner(current.db, owner, async (journal) => {
      expect(await journal.knownDependency("foreign-save")).toEqual(expected);
      // Released indexed flags have no publication clock, so both facts need coverage backfill.
      expect((await journal.unindexed()).map((entry) => entry.decision.epoch)).toEqual(["aaa", "zzz"]);
      expect(await journal.publishedReceipt("foreign-save", "aaa")).toBeUndefined();
      expect(await journal.knownDependency("foreign-save")).toEqual(expected);
      await journal.recordDecision({ ...expected, epoch: "zzz", state: "refused" }, "second");
      expect((await journal.knownDependency("foreign-save"))?.epoch).toBe("zzz");
    });
    await current.close();
    current = await createDb({ path: old.path });
    await withOrderedOwner(current.db, owner, async (journal) => {
      expect((await journal.knownDependency("foreign-save"))?.epoch).toBe("zzz");
      expect(await journal.cachedDecision("foreign-save", "aaa")).toEqual(expected);
    });
  } finally {
    if (!oldClosed) await old.close();
    await current?.close();
    await rm(root, { recursive: true, force: true });
  }
});
