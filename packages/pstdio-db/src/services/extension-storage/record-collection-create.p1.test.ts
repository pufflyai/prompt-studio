import { expect, test } from "bun:test";
import { createCollectionRecordsIfAbsent } from "@pstdio/sdk/data";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

test("bounded collection creation preserves existing and concurrently created records in DB and memory", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const native = await fixture.svc.open({ owner: { workbenchId: fixture.projectAId, extensionId: "ext.example" } });
    for (const records of [
      native.scopedRecords("resource", "selected"),
      createMemoryStorage().scope({ type: "resource", resource: { type: "foobar", id: "selected" } }).records,
    ]) {
      const storage = { records: { ...records }, ids: { create: () => crypto.randomUUID() } };
      await createCollectionRecordsIfAbsent(storage, "cards", [{ id: "existing", value: { title: "Keep" } }]);
      const originalRead = records.readMany;
      storage.records.readMany = async (ids) => {
        const observed = await originalRead(ids);
        const concurrent = observed.find(({ recordId }) => JSON.parse(recordId).at(-1) === "raced")!;
        await records.commit({
          operationId: crypto.randomUUID(),
          edits: [{ recordId: concurrent.recordId, replace: { value: { title: "Concurrent" }, sortOrder: null } }],
        });
        return observed;
      };
      await createCollectionRecordsIfAbsent(
        storage,
        "cards",
        ["existing", "raced", "new"].map((id) => ({ id, value: { title: "Initial" } })),
      );
      const namespace = JSON.parse(records.id("unused")).slice(0, -2);
      const read = (id: string) => records.read(JSON.stringify([...namespace, "collection", "cards", id]));
      expect((await read("existing")).value).toMatchObject({ value: { title: "Keep" } });
      expect((await read("raced")).value).toMatchObject({ value: { title: "Concurrent" } });
      expect((await read("new")).value).toMatchObject({ value: { title: "Initial" } });
      const items = ["first", "second"].map((id) => ({ id, value: { title: id } }));
      storage.records.readMany = async (ids) => {
        const observed = await originalRead(ids);
        items.reverse();
        items[0].value.title = "Changed while saving";
        return observed;
      };
      await createCollectionRecordsIfAbsent(storage, "cards", items);
      expect((await read("first")).value).toMatchObject({ value: { title: "first" } });
      expect((await read("second")).value).toMatchObject({ value: { title: "second" } });
      await expect(
        createCollectionRecordsIfAbsent(
          storage,
          "cards",
          Array.from({ length: 101 }, (_, i) => ({ id: String(i), value: {} })),
        ),
      ).rejects.toThrow("100");
    }
  } finally {
    await fixture.close();
  }
});
