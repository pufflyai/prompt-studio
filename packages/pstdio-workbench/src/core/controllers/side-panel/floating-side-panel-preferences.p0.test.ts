import { expect, test } from "bun:test";
import { createLocalStoragePreferencePersistence } from "../../../storage/local-storage-preference-persistence";
import { createWorkbench } from "../../workbench-core";

const movement = "workbench.sidePanel.floating.movement";
const frame = "workbench.sidePanel.floating.frame";

test("floating panels default to snapping and keep their initial size until customized", async () => {
  const workbench = createWorkbench();
  try {
    expect(workbench.preferences.getValue(movement)).toBe("snap");
    expect(workbench.preferences.getValue(frame)).toEqual({});
  } finally {
    await workbench.dispose();
  }
});

test("floating movement, size, and free position survive reopening the workbench", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
  const create = () =>
    createWorkbench({ preferencePersistence: createLocalStoragePreferencePersistence(storage, "floating-panel") });
  const workbench = create();
  let restored: ReturnType<typeof create> | undefined;
  try {
    await workbench.preferences.setValue(movement, "free", { scope: "user" });
    await workbench.preferences.setValue(frame, { x: 160, y: 96, width: 480, height: 420 }, { scope: "user" });
    restored = create();
    expect(restored.preferences.getValue(movement)).toBe("free");
    expect(restored.preferences.getValue(frame)).toEqual({ x: 160, y: 96, width: 480, height: 420 });
  } finally {
    await workbench.dispose();
    await restored?.dispose();
  }
});
