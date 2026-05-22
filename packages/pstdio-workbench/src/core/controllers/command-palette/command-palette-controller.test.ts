import { describe, expect, test } from "bun:test";
import { createWorkbenchCommandPaletteController } from "./command-palette-controller";

describe("createWorkbenchCommandPaletteController", () => {
  test("opens and closes through domain methods and exposes store state", () => {
    const controller = createWorkbenchCommandPaletteController();

    expect(controller.isOpen()).toBe(false);
    expect(controller.store.getState()).toEqual({ open: false, view: "main", initialQuery: "" });

    controller.open();

    expect(controller.isOpen()).toBe(true);
    expect(controller.store.getState()).toEqual({ open: true, view: "main", initialQuery: "" });

    controller.close();

    expect(controller.isOpen()).toBe(false);
  });

  test("opens a specific view and resets it when closed", () => {
    const controller = createWorkbenchCommandPaletteController();

    controller.open({ view: "theme", initialQuery: "> " });

    expect(controller.isOpen()).toBe(true);
    expect(controller.getView()).toBe("theme");
    expect(controller.getInitialQuery()).toBe("> ");

    controller.close();

    expect(controller.store.getState()).toEqual({ open: false, view: "main", initialQuery: "" });
  });

  test("toggle flips between open and closed", () => {
    const controller = createWorkbenchCommandPaletteController();

    controller.toggle();
    expect(controller.isOpen()).toBe(true);

    controller.toggle();
    expect(controller.isOpen()).toBe(false);
  });

  test("emits change events through onDidChange and store subscribers", () => {
    const controller = createWorkbenchCommandPaletteController();
    const events: boolean[] = [];
    const storeEvents: boolean[] = [];

    const legacy = controller.onDidChange((value) => events.push(value));
    const fromStore = controller.store.subscribeSelector(
      (state) => state.open,
      (value) => storeEvents.push(value),
    );

    controller.open();
    controller.open();
    controller.close();
    controller.toggle();

    expect(events).toEqual([true, false, true]);
    expect(storeEvents).toEqual([true, false, true]);

    legacy.dispose();
    fromStore();
  });

  test("honors initialOpen", () => {
    const controller = createWorkbenchCommandPaletteController({ initialOpen: true });

    expect(controller.isOpen()).toBe(true);
  });
});
