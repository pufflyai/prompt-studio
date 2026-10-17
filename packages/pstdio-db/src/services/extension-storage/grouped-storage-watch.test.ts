import { afterEach, expect, test } from "bun:test";
import { createGroupedStorageDBService } from "./grouped-storage";
import { openGroupedTestStorage, groupedStorageOwner as owner } from "./grouped-storage-test-fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("local journal wakeups follow committed writes and ignore reads and rolled-back writes", async () => {
  const fixture = await openGroupedTestStorage(cleanup);
  const service = createGroupedStorageDBService(fixture.db);
  const records = service.open({ owner, environmentId: "environment-a" }).records;
  const changed: unknown[] = [];
  const stop = service.watch((owner) => changed.push(owner));
  const note = await records.read("note");
  expect(changed).toHaveLength(0);
  await records.commit({
    operationId: "committed",
    edits: [{ recordId: "note", expectedRevision: note.revision, replace: "saved" }],
  });
  expect(changed).toEqual([owner]);
  expect((await records.read("note")).value).toBe("saved");
  expect(changed).toHaveLength(1);
  await expect(
    service.transaction(owner, async (state) => {
      state.journal.push(state.journal[0]);
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  expect(changed).toHaveLength(1);
  stop();
  await records.commit({
    operationId: "unsubscribed",
    edits: [{ recordId: "second", expectedRevision: (await records.read("second")).revision, replace: "saved" }],
  });
  expect(changed).toHaveLength(1);
});
