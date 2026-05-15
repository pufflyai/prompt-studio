import { describe, expect, test } from "bun:test";
import { createShellCommandPaletteController } from "./command-palette-controller";

describe("createShellCommandPaletteController", () => {
  test("opens and closes through domain methods and exposes store state", () => {
    const controller = createShellCommandPaletteController();

    expect(controller.isOpen()).toBe(false);
    expect(controller.store.getState()).toEqual({ open: false });

    controller.open();

    expect(controller.isOpen()).toBe(true);
    expect(controller.store.getState()).toEqual({ open: true });

    controller.close();

    expect(controller.isOpen()).toBe(false);
  });

  test("toggle flips between open and closed", () => {
    const controller = createShellCommandPaletteController();

    controller.toggle();
    expect(controller.isOpen()).toBe(true);

    controller.toggle();
    expect(controller.isOpen()).toBe(false);
  });

  test("emits change events through onDidChange and store subscribers", () => {
    const controller = createShellCommandPaletteController();
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
    const controller = createShellCommandPaletteController({ initialOpen: true });

    expect(controller.isOpen()).toBe(true);
  });
});
