import { expect, test } from "bun:test";
import { memoryDocumentState } from "pstdio-sync";
import { createDocumentStorage } from "pstdio-sync/records";
import * as Y from "yjs";
import { createMemoryStorage } from "./memory-storage";
import { createMemoryStorageDevices } from "./memory-storage-devices";

test("offline migrations with different source lists leave every neighbour movable", async () => {
  const pair = await createMemoryStorageDevices();
  const put = async (device: (typeof pair.devices)[number], recordId: string, value: Record<string, number | string>) =>
    device.records.commit({ operationId: device.ids.create(), edits: [{ recordId, replace: value }] });
  await put(pair.devices[0], "a", { oldOrder: 0 });
  await put(pair.devices[0], "c", { oldOrder: 2 });
  await pair.merge();
  await put(pair.devices[0], "b", { oldOrder: 1 });
  await put(pair.devices[1], "d", { oldOrder: 1 });

  for (const device of pair.devices) {
    await device.migrate(1, async (_, migration) => {
      const rows = (await device.records.list())
        .map((row) => ({
          ...row,
          value: row.value as Record<string, number | string>,
        }))
        .sort((left, right) => {
          const difference = Number(left.value.oldOrder) - Number(right.value.oldOrder);
          if (difference) return difference;
          return left.recordId < right.recordId ? -1 : 1;
        });
      for (const [rank, row] of rows.entries()) {
        await device.records.commit({
          operationId: migration.id(`position:${row.recordId}`),
          edits: [
            { recordId: row.recordId, replace: { ...row.value!, position: migration.position(rank, row.recordId) } },
          ],
        });
      }
    });
  }
  await pair.merge();
  const ordered = async (device: (typeof pair.devices)[number]) =>
    (await device.records.list())
      .map(({ recordId, value }) => ({ recordId, position: String((value as Record<string, string>).position) }))
      .sort((left, right) => (left.position < right.position ? -1 : 1));
  const migrated = await ordered(pair.devices[0]);
  expect(await ordered(pair.devices[1])).toEqual(migrated);
  expect(new Set(migrated.map(({ position }) => position)).size).toBe(4);
  const neighbours = migrated.filter(({ recordId }) => recordId === "b" || recordId === "d");
  for (const device of pair.devices) {
    const position = device.positions.between(neighbours[0]!.position, neighbours[1]!.position);
    await put(device, "a", { oldOrder: 0, position });
  }
  await pair.merge();
  const moved = await ordered(pair.devices[0]);
  expect(await ordered(pair.devices[1])).toEqual(moved);
  expect(moved.map(({ recordId }) => recordId).sort()).toEqual(["a", "b", "c", "d"]);
  expect(new Set(moved.map(({ position }) => position)).size).toBe(4);
});

test("concurrent moves converge to the same order with each stable item once", async () => {
  const device = (id: string) => {
    const document = new Y.Doc();
    const state = memoryDocumentState(document);
    const storage = createDocumentStorage({
      owner: { extensionId: "notes", workbenchId: "shared" },
      store: { transaction: async (_owner, run) => run(state) },
    });
    const { positions } = createMemoryStorage({ deviceId: id });
    const move = (recordId: string, position: string) =>
      storage.records.commit({ operationId: crypto.randomUUID(), edits: [{ recordId, replace: { position } }] });
    return { document, storage, positions, move };
  };
  const first = device("device-a");
  const second = device("device-b");
  const a = first.positions.between();
  const b = first.positions.between(a);
  const c = first.positions.between(b);
  await first.move("a", a);
  await first.move("b", b);
  await first.move("c", c);
  Y.applyUpdate(second.document, Y.encodeStateAsUpdate(first.document));

  // Both devices move a and c into the same gap while offline.
  for (const current of [first, second]) {
    await current.move("a", current.positions.between(b, c));
    await current.move("c", current.positions.between(b, c));
  }
  const updates = [first, second].map(({ document }) => Y.encodeStateAsUpdate(document));
  for (const current of [first, second]) {
    for (const update of [...updates].reverse()) Y.applyUpdate(current.document, update);
  }
  const ordered = async (current: typeof first) => {
    const records = (await current.storage.records.list()).map(({ recordId, value }) => {
      expect(typeof (value as Record<string, string>).position).toBe("string");
      return { recordId, position: (value as Record<string, string>).position! };
    });
    return records.sort((left, right) => (left.position < right.position ? -1 : 1));
  };
  const result = await ordered(first);
  expect(await ordered(second)).toEqual(result);
  expect(result.map(({ recordId }) => recordId).sort()).toEqual(["a", "b", "c"]);
  expect(new Set(result.map(({ position }) => position)).size).toBe(3);
  first.document.destroy();
  second.document.destroy();
});
