import type { ExtensionStorageApi, SharedStorageEdit } from "@pstdio/sdk/extensions";
import type { CanvasDefinition } from "./canvases/definitions";
import { object, readLayout, updateLayout } from "./layout";

const recordId = (storage: ExtensionStorageApi, canvas: CanvasDefinition) => storage.records.id(`layout:${canvas.id}`);
export const loadLayout = async (storage: ExtensionStorageApi, canvas: CanvasDefinition) => {
  const record = await storage.records.read(recordId(storage, canvas));
  const value = object(record.shared?.kind === "map" ? record.shared.value : record.value);
  const positions = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.startsWith("position:"))
      .map(([key, position]) => [key.slice(9), position]),
  );
  return readLayout({ ...value, positions }, canvas.items);
};
export const saveLayout = async (storage: ExtensionStorageApi, canvas: CanvasDefinition, change: unknown) => {
  const patch = object(change);
  const next = updateLayout(readLayout(null, canvas.items), patch, canvas.items);
  const edits: SharedStorageEdit[] = [{ kind: "map.set", key: "version", value: 1 }];
  if (patch.camera) edits.push({ kind: "map.set", key: "camera", value: { ...next.camera } });
  const positions = object(patch.positions);
  for (const item of canvas.items) {
    if (Object.hasOwn(positions, item.id))
      edits.push({ kind: "map.set", key: `position:${item.id}`, value: { ...next.positions[item.id] } });
  }
  // Each item is one map entry, so moving one frame preserves simultaneous moves of other frames.
  await storage.records.commit({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: recordId(storage, canvas), shared: edits }],
  });
  return loadLayout(storage, canvas);
};
