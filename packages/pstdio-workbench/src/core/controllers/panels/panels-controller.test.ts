import { describe, expect, test } from "bun:test";
import { createWorkbenchPanelsController, type PersistedWorkbenchPanels } from "./panels-controller";

describe("createWorkbenchPanelsController", () => {
  test("defaults isOpen to true for any unseen area", () => {
    const panels = createWorkbenchPanelsController();

    expect(panels.isOpen("left")).toBe(true);
    expect(panels.isOpen("main-right")).toBe(true);
    expect(panels.store.getState()).toEqual({ openByAreaId: {} });
  });

  test("setOpen tracks state and ignores no-op writes", () => {
    const panels = createWorkbenchPanelsController();
    const events: boolean[] = [];

    const unsubscribe = panels.store.subscribeSelector(
      (state) => state.openByAreaId.left,
      (value) => events.push(value ?? true),
    );

    panels.setOpen("left", true);
    panels.setOpen("left", false);
    panels.setOpen("left", false);
    panels.setOpen("left", true);

    expect(panels.isOpen("left")).toBe(true);
    expect(events).toEqual([false, true]);

    unsubscribe();
  });

  test("toggle flips state", () => {
    const panels = createWorkbenchPanelsController();

    panels.toggle("secondary");
    expect(panels.isOpen("secondary")).toBe(false);

    panels.toggle("secondary");
    expect(panels.isOpen("secondary")).toBe(true);
  });

  test("hydrates from persistence and writes back through the adapter", () => {
    const stored: PersistedWorkbenchPanels[] = [{ openByAreaId: { left: false, "main-right": false } }];
    const persistence = {
      getPanelStates: () => stored.at(-1),
      setPanelStates: (next: PersistedWorkbenchPanels) => {
        stored.push(next);
      },
    };

    const panels = createWorkbenchPanelsController({ persistence });

    expect(panels.isOpen("left")).toBe(false);
    expect(panels.isOpen("main-right")).toBe(false);

    panels.setOpen("left", true);

    expect(stored.at(-1)?.openByAreaId).toEqual({ left: true, "main-right": false });
  });

  test("onDidChange fires for any state mutation", () => {
    const panels = createWorkbenchPanelsController();
    const events: string[] = [];

    const disposable = panels.onDidChange((state) => {
      events.push(JSON.stringify(state.openByAreaId));
    });

    panels.setOpen("left", false);
    panels.setOpen("secondary", false);

    expect(events).toEqual([JSON.stringify({ left: false }), JSON.stringify({ left: false, secondary: false })]);

    disposable.dispose();
    panels.setOpen("left", true);
    expect(events).toHaveLength(2);
  });
});
