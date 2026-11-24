import { expect, test } from "bun:test";
import { act, create as createRenderer, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, sidePanelBubblePreferences } from "../../core";
import { createLocalStoragePreferencePersistence } from "../../storage/local-storage-preference-persistence";
import { useSidePanelLauncherVisible } from "./side-panel";

test("the visibility preference updates the launcher and survives reopening the workbench", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
  const create = () =>
    createWorkbench({
      initialSidePanelMode: "closed",
      preferencePersistence: createLocalStoragePreferencePersistence(storage, "preferences"),
    });
  const workbench = create();
  let shown: boolean | undefined;
  const Capture = () => {
    shown = useSidePanelLauncherVisible(workbench, true);
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  let restored: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      renderer = createRenderer(<Capture />);
    });
    expect(shown).toBe(true);
    await act(async () => workbench.preferences.setValue(sidePanelBubblePreferences.visible, false, { scope: "user" }));
    expect(shown).toBe(false);
    expect(workbench.sidePanel.getMode()).toBe("closed");
    await workbench.preferences.setValue(sidePanelBubblePreferences.alignment, "center", { scope: "user" });
    await workbench.preferences.setValue(sidePanelBubblePreferences.panel, "panel:inspector", { scope: "user" });
    restored = create();
    expect(restored.preferences.getValue(sidePanelBubblePreferences.visible)).toBe(false);
    expect(restored.preferences.getValue(sidePanelBubblePreferences.alignment)).toBe("center");
    expect(restored.preferences.getValue(sidePanelBubblePreferences.panel)).toBe("panel:inspector");
    await act(async () => restored!.preferences.setValue(sidePanelBubblePreferences.visible, true, { scope: "user" }));
    expect(shown).toBe(true);
  } finally {
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    await restored?.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
