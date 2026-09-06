import { describe, expect, test } from "bun:test";
import {
  createWorkbenchPanelMenuStateController,
  type PersistedWorkbenchPanelMenuState,
} from "./panel-menu-state-controller";

describe("createWorkbenchPanelMenuStateController", () => {
  test("defaults isOpen to true for any unseen menu", () => {
    const panels = createWorkbenchPanelMenuStateController();

    expect(panels.isOpen("files")).toBe(true);
    expect(panels.isOpen("main-right-menu")).toBe(true);
    expect(panels.store.getState()).toEqual({ openByMenuId: {} });
  });

  test("setOpen tracks state and ignores no-op writes", () => {
    const panels = createWorkbenchPanelMenuStateController();
    const events: boolean[] = [];

    const unsubscribe = panels.store.subscribeSelector(
      (state) => state.openByMenuId.files,
      (value) => events.push(value ?? true),
    );

    panels.setOpen("files", true);
    panels.setOpen("files", false);
    panels.setOpen("files", false);
    panels.setOpen("files", true);

    expect(panels.isOpen("files")).toBe(true);
    expect(events).toEqual([false, true]);

    unsubscribe();
  });

  test("toggle flips state", () => {
    const panels = createWorkbenchPanelMenuStateController();

    panels.toggle("details");
    expect(panels.isOpen("details")).toBe(false);

    panels.toggle("details");
    expect(panels.isOpen("details")).toBe(true);
  });

  test("hydrates from persistence and writes back through the adapter", () => {
    const stored: PersistedWorkbenchPanelMenuState[] = [{ openByMenuId: { files: false, "main-right-menu": false } }];
    const persistence = {
      getMenuStates: () => stored.at(-1),
      setMenuStates: (next: PersistedWorkbenchPanelMenuState) => {
        stored.push(next);
      },
    };

    const panels = createWorkbenchPanelMenuStateController({ persistence });

    expect(panels.isOpen("files")).toBe(false);
    expect(panels.isOpen("main-right-menu")).toBe(false);

    panels.setOpen("files", true);

    expect(stored.at(-1)?.openByMenuId).toEqual({ files: true, "main-right-menu": false });
  });

  test("persists independent open state per project scope", () => {
    const stored = new Map<string, PersistedWorkbenchPanelMenuState>();
    const panels = createWorkbenchPanelMenuStateController({
      persistence: {
        getMenuStates: (scope) => stored.get(scope ?? "global"),
        setMenuStates: (state, scope) => stored.set(scope ?? "global", state),
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
    const panels = createWorkbenchPanelMenuStateController();
    const events: string[] = [];

    const disposable = panels.onDidChange((state) => {
      events.push(JSON.stringify(state.openByMenuId));
    });

    panels.setOpen("files", false);
    panels.setOpen("details", false);

    expect(events).toEqual([JSON.stringify({ files: false }), JSON.stringify({ files: false, details: false })]);

    disposable.dispose();
    panels.setOpen("files", true);
    expect(events).toHaveLength(2);
  });
});
