import { expect, test } from "bun:test";
import { createMemoryStorageDevices } from "../../../packages/sdk/src/testing/memory-storage-devices";
import type { CanvasDefinition } from "./canvas-model";
import { loadLayout, saveLayout } from "./layout-store";

const canvas: CanvasDefinition = {
  id: "canvas",
  name: "Canvas",
  group: "",
  items: ["first/frame", "second~frame"].map((id, index) => ({
    id,
    name: id,
    position: { x: index * 10, y: 0 },
    width: 10,
    height: 10,
    preview: { source: "canvas.tsx", exportName: id, viewportHeight: 10, revision: "one" },
  })),
};
test("offline frame movements save ordinary fields and preserve the other frame", async () => {
  const pair = await createMemoryStorageDevices();
  const [first, second] = pair.devices;
  await saveLayout(first, canvas, { camera: { x: 1, y: 2, zoom: 1 } });
  await pair.merge();
  await saveLayout(first, canvas, { positions: { "first/frame": { x: 100, y: 10 } } });
  await saveLayout(second, canvas, { positions: { "second~frame": { x: 200, y: 20 } } });
  await pair.merge();
  for (const storage of pair.devices) {
    expect((await loadLayout(storage, canvas)).positions).toEqual({
      "first/frame": { x: 100, y: 10 },
      "second~frame": { x: 200, y: 20 },
    });
    const record = await storage.records.read(storage.records.id("layout:canvas"));
    expect(record.value).toMatchObject({
      version: 1,
      "position:first/frame": { x: 100, y: 10 },
      "position:second~frame": { x: 200, y: 20 },
    });
    expect(record.shared).toBeNull();
  }
});

test("existing shared layouts move once to ordinary fields without losing untouched positions", async () => {
  const {
    devices: [storage],
  } = await createMemoryStorageDevices();
  const id = storage.records.id("layout:canvas");
  await storage.records.commit({
    operationId: "old",
    edits: [
      {
        recordId: id,
        shared: [
          { kind: "map.set", key: "version", value: 1 },
          { kind: "map.set", key: "position:second~frame", value: { x: 20, y: 30 } },
        ],
      },
    ],
  });
  await loadLayout(storage, canvas);
  expect((await storage.records.read(id)).value).toMatchObject({
    version: 1,
    "position:second~frame": { x: 20, y: 30 },
  });
  await saveLayout(storage, canvas, { positions: { "first/frame": { x: 100, y: 10 } } });
  expect((await loadLayout(storage, canvas)).positions).toEqual({
    "first/frame": { x: 100, y: 10 },
    "second~frame": { x: 20, y: 30 },
  });
});
