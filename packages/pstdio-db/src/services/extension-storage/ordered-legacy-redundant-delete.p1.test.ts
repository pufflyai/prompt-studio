import { expect, test } from "bun:test";
import { peers } from "./ordered-legacy-pending.fixture";

// Deleting an already deleted record writes a new tombstone entry that replaces the previous one.
// The replacement is not a restore, so conversion must keep the record deleted.
for (const synced of [true, false])
  test(`a pending delete of an already ${synced ? "synced" : "local"} tombstone stays deleted after upgrade`, async () => {
    const { first } = await peers();
    await first.legacy.commit({ operationId: "seed", edits: [{ recordId: "card", replace: { title: "x" } }] });
    await first.legacy.commit({ operationId: "delete", edits: [{ recordId: "card", deleted: true }] });
    if (synced) await first.oldSync.synchronize();
    await first.legacy.commit({ operationId: "delete-again", edits: [{ recordId: "card", deleted: true }] });
    expect((await first.legacy.read("card")).deleted).toBe(true);

    expect((await first.upgrade().records.read("card")).deleted).toBe(true);
  });

test("a pending restore of a deleted record still restores it after upgrade", async () => {
  const { first } = await peers();
  await first.legacy.commit({ operationId: "seed", edits: [{ recordId: "card", replace: { title: "x" } }] });
  await first.legacy.commit({ operationId: "delete", edits: [{ recordId: "card", deleted: true }] });
  await first.oldSync.synchronize();
  await first.legacy.commit({ operationId: "restore", edits: [{ recordId: "card", deleted: false }] });
  expect((await first.legacy.read("card")).deleted).toBe(false);

  expect((await first.upgrade().records.read("card")).deleted).toBe(false);
});
