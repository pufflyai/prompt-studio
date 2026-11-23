import { expect, test } from "bun:test";
import { useRef } from "react";
import { act, create as createRenderer, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, floatingSidePanelPreferences } from "../../core";
import { createLocalStoragePreferencePersistence } from "../../storage/local-storage-preference-persistence";
import { useFloatingSidePanel } from "./use-floating-side-panel";

test("a saved floating frame remains usable through local storage and preference updates", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
  const workbench = createWorkbench({
    preferencePersistence: createLocalStoragePreferencePersistence(storage, "floating-frame"),
  });
  let renderer: ReactTestRenderer | undefined;
  const Capture = () => {
    const panelRef = useRef<HTMLDivElement>(null);
    const panel = useFloatingSidePanel({ workbench, panelRef, visible: false, resizable: true, bottom: "0px" });
    return <span>{panel.frameProps["data-floating-panel-movement"]}</span>;
  };
  try {
    await workbench.preferences.setValue(
      floatingSidePanelPreferences.frame,
      { x: 160, y: 96, width: 480, height: 420 },
      { scope: "user" },
    );
    await workbench.preferences.setValue(floatingSidePanelPreferences.movement, "free", { scope: "user" });
    await act(async () => {
      renderer = createRenderer(<Capture />);
    });
    expect(renderer!.toJSON()).toMatchObject({ children: ["free"] });
    await act(async () => {
      await workbench.preferences.setValue(
        floatingSidePanelPreferences.frame,
        { x: 192, y: 120, width: 520, height: 440 },
        { scope: "user" },
      );
      await workbench.preferences.setValue(floatingSidePanelPreferences.movement, "snap", { scope: "user" });
    });
    expect(renderer!.toJSON()).toMatchObject({ children: ["snap"] });
  } finally {
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
