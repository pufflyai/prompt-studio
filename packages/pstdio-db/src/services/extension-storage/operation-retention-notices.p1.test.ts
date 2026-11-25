import { expect, test } from "bun:test";
import { prepareOrderedOperation } from "pstdio-sync/records";
import { createOperationRetentionFixture } from "./operation-retention.fixture";
import { withOrderedOwner } from "./ordered-journal";
import { readOrderedMarker } from "./ordered-native-metadata";
import { recordOrderedReplaced } from "./ordered-return-review";
import { pruneSettledOperations } from "./prune-operations";

test("settled and pruned own saves retain replacement notices without claiming foreign saves", async () => {
  const f = await createOperationRetentionFixture();
  const seed = { operationId: "own-notice", edits: [{ recordId: "own-card", replace: true }] };
  try {
    await f.records.commit(seed);
    await f.sync.synchronize();
    await pruneSettledOperations(f.db, f.owner, new Date(Date.now() + 8 * 86_400_000));
    await withOrderedOwner(f.db, f.owner, async (journal, tx) => {
      for (const [operationId, recordId] of [
        [seed.operationId, "own-card"],
        ["foreign-notice", "foreign-card"],
      ]) {
        const operation = await prepareOrderedOperation(
          { operationId: operationId!, edits: [{ recordId: recordId!, replace: true }] },
          new Map(),
        );
        await recordOrderedReplaced(journal, tx, f.owner, operation, [
          { recordId: recordId!, paths: ["/title"], whole: false },
        ]);
      }
      expect(
        (await readOrderedMarker(tx, f.owner, JSON.stringify(["ordered-replaced", "own-card"])))?.value,
      ).toMatchObject({ paths: ["/title"] });
      expect(
        await readOrderedMarker(tx, f.owner, JSON.stringify(["ordered-replaced", "foreign-card"])),
      ).toBeUndefined();
    });
  } finally {
    await f.close();
  }
});
