import { describe, expect, test } from "bun:test";
import { createWorkbenchPanelsController, type PersistedWorkbenchPanels } from "./panels-controller";

describe("createWorkbenchPanelsController", () => {
  test("defaults isOpen to true for any unseen region", () => {
    const panels = createWorkbenchPanelsController();

    expect(panels.isOpen("sidebar")).toBe(true);
    expect(panels.isOpen("main-right-menu")).toBe(true);
    expect(panels.store.getState()).toEqual({ openByRegionId: {} });
  });

  test("setOpen tracks state and ignores no-op writes", () => {
    const panels = createWorkbenchPanelsController();
    const events: boolean[] = [];

    const unsubscribe = panels.store.subscribeSelector(
      (state) => state.openByRegionId.sidebar,
      (value) => events.push(value ?? true),
    );

    panels.setOpen("sidebar", true);
    panels.setOpen("sidebar", false);
    panels.setOpen("sidebar", false);
    panels.setOpen("sidebar", true);

    expect(panels.isOpen("sidebar")).toBe(true);
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
    const stored: PersistedWorkbenchPanels[] = [{ openByRegionId: { sidebar: false, "main-right-menu": false } }];
    const persistence = {
      getPanelStates: () => stored.at(-1),
      setPanelStates: (next: PersistedWorkbenchPanels) => {
        stored.push(next);
      },
    };

    const panels = createWorkbenchPanelsController({ persistence });

    expect(panels.isOpen("sidebar")).toBe(false);
    expect(panels.isOpen("main-right-menu")).toBe(false);

    panels.setOpen("sidebar", true);

    expect(stored.at(-1)?.openByRegionId).toEqual({ sidebar: true, "main-right-menu": false });
  });

  test("persists independent open state per project scope", () => {
    const stored = new Map<string, PersistedWorkbenchPanels>();
    const panels = createWorkbenchPanelsController({
      persistence: {
        getPanelStates: (scope) => stored.get(scope ?? "global"),
        setPanelStates: (state, scope) => stored.set(scope ?? "global", state),
      },
    });

    panels.setPersistenceScope("project:one");
    panels.setOpen("main-right-menu", false);
    panels.setPersistenceScope("project:two");
    expect(panels.isOpen("main-right-menu")).toBe(true);

    panels.setOpen("main-right-menu", true);
    panels.setPersistenceScope("project:one");
    expect(panels.isOpen("main-right-menu")).toBe(false);
    expect(panels.getPersistenceScope()).toBe("project:one");
  });

  test("onDidChange fires for any state mutation", () => {
    const panels = createWorkbenchPanelsController();
    const events: string[] = [];

    const disposable = panels.onDidChange((state) => {
      events.push(JSON.stringify(state.openByRegionId));
    });

    panels.setOpen("sidebar", false);
    panels.setOpen("secondary", false);

    expect(events).toEqual([JSON.stringify({ sidebar: false }), JSON.stringify({ sidebar: false, secondary: false })]);

    disposable.dispose();
    panels.setOpen("sidebar", true);
    expect(events).toHaveLength(2);
  });
});
