import type { ExtensionStorageApi, JsonValue } from "@pstdio/sdk/extensions";
import type { CanvasDefinition } from "./canvas-model";
import { object, readLayout, updateLayout } from "./layout";
import { migrateLayouts } from "./layout-migration";

const recordId = (storage: ExtensionStorageApi, canvas: CanvasDefinition) => storage.records.id(`layout:${canvas.id}`);
const field = (key: string) => `/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
export const loadLayout = async (storage: ExtensionStorageApi, canvas: CanvasDefinition) => {
  await migrateLayouts(storage);
  const record = await storage.records.read(recordId(storage, canvas));
  const value = object(record.value);
  const positions = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.startsWith("position:"))
      .map(([key, position]) => [key.slice(9), position]),
  );
  const themes = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.startsWith("theme:"))
      .map(([key, theme]) => [key.slice(6), theme]),
  );
  return readLayout(
    {
      ...value,
      positions: { ...object(value.positions), ...positions },
      themes: { ...object(value.themes), ...themes },
    },
    canvas.items,
  );
};
export const saveLayout = async (storage: ExtensionStorageApi, canvas: CanvasDefinition, change: unknown) => {
  await migrateLayouts(storage);
  const patch = object(change);
  const next = updateLayout(readLayout(null, canvas.items), patch, canvas.items);
  const set: Record<string, JsonValue> = { "/version": 1 };
  if (patch.camera) set["/camera"] = { ...next.camera };
  const positions = object(patch.positions);
  for (const item of canvas.items) {
    if (Object.hasOwn(positions, item.id)) set[field(`position:${item.id}`)] = { ...next.positions[item.id] };
    if (Object.hasOwn(object(patch.themes), item.id) && next.themes[item.id])
      set[field(`theme:${item.id}`)] = next.themes[item.id];
  }
  await storage.records.commit({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: recordId(storage, canvas), set }],
  });
  return loadLayout(storage, canvas);
};
