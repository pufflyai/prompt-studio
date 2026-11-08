import { expect, test } from "bun:test";
import { peers } from "./ordered-legacy-pending.fixture";

test("a pending delete stays deleted through upgrade and stale-device replay", async () => {
  const { first, second } = await peers();
  await first.legacy.commit({ operationId: "create", edits: [{ recordId: "card", replace: "retained" }] });
  await first.oldSync.synchronize();
  await second.oldSync.synchronize();
  // The second device retains the live record while the first still has an unsent delete.
  await first.legacy.commit({ operationId: "delete", edits: [{ recordId: "card", deleted: true }] });
  const upgraded = first.upgrade();
  expect((await upgraded.records.read("card")).deleted).toBe(true);
  await upgraded.sync.synchronize();
  const stale = second.upgrade();
  await stale.sync.synchronize();
  expect((await stale.records.read("card")).deleted).toBe(true);
  expect((await upgraded.records.read("card")).deleted).toBe(true);
});

test("an unsent create and delete in the same backlog keep their final tombstone after upgrade", async () => {
  const { first } = await peers();
  await first.legacy.commit({ operationId: "create", edits: [{ recordId: "card", replace: "retained" }] });
  await first.legacy.commit({ operationId: "delete", edits: [{ recordId: "card", deleted: true }] });
  expect((await first.legacy.read("card")).deleted).toBe(true);
  expect((await first.upgrade().records.read("card")).deleted).toBe(true);
});

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
